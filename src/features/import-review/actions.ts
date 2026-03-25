"use server";

import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createUploadReviewDrafts } from "@/features/import-review/upload-review-service";
import type {
  ReviewDraftFieldName,
  ReviewDraftFormState
} from "@/features/import-review/form-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function reviewPath(importGroupId: string, notice?: string) {
  return (notice
    ? `/register/review/${importGroupId}?notice=${encodeURIComponent(notice)}`
    : `/register/review/${importGroupId}`) as Route;
}

function registerPath(notice?: string) {
  return (notice ? `/register?notice=${encodeURIComponent(notice)}` : "/register") as Route;
}

function pendingPath(notice?: string) {
  return (notice
    ? `/register/pending?notice=${encodeURIComponent(notice)}`
    : "/register/pending") as Route;
}

function receiptPath(notice?: string) {
  return (notice
    ? `/register/receipt?notice=${encodeURIComponent(notice)}`
    : "/register/receipt") as Route;
}

function creditPath(notice?: string) {
  return (notice
    ? `/register/credit?notice=${encodeURIComponent(notice)}`
    : "/register/credit") as Route;
}

function deriveNeedsReview(input: {
  title: string;
  amount: number | null;
  categoryId: string | null;
}) {
  return !input.title.trim() || input.amount == null || input.amount <= 0 || !input.categoryId;
}

const importGroupSchema = z.object({
  importGroupId: z.string().uuid()
});

const updateDraftSchema = z.object({
  importGroupId: z.string().uuid(),
  draftId: z.string().uuid(),
  title: z
    .string()
    .trim()
    .min(1, "内容を入力してください。")
    .max(120, "内容は120文字以内で入力してください。"),
  occurredOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "日付を入力してください。"),
  merchantName: z
    .string()
    .trim()
    .max(120, "店舗名または利用先は120文字以内で入力してください。")
    .optional(),
  amount: z.coerce
    .number()
    .int("金額は整数で入力してください。")
    .positive("金額は1円以上で入力してください。")
    .max(9_999_999, "金額が大きすぎます。"),
  categoryId: z.string().uuid("カテゴリを選択してください。"),
  note: z.string().trim().max(300, "メモは300文字以内で入力してください。").optional()
});

const bulkDraftItemSchema = z.object({
  draftId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  occurredOn: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  merchantName: z.string().trim().max(120).optional(),
  amount: z.string().trim().min(1),
  categoryId: z.string().uuid(),
  note: z.string().trim().max(300).optional()
});

function isReviewDraftFieldName(value: string): value is ReviewDraftFieldName {
  return ["occurredOn", "merchantName", "title", "amount", "categoryId", "note"].includes(value);
}

export async function createDummyReceiptReviewAction() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: categories } = await supabase
    .from("categories")
    .select("id, slug")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const foodCategoryId = categories?.find((category) => category.slug === "food")?.id ?? null;
  const dailyCategoryId =
    categories?.find((category) => category.slug === "daily-necessities")?.id ?? foodCategoryId;

  const occurredOn = new Date().toISOString().slice(0, 10);
  const merchantName = "サンプルストア";
  const { data: importGroup, error: importGroupError } = await supabase
    .from("import_groups")
    .insert({
      user_id: user.id,
      source_type: "receipt",
      status: "draft",
      title: "ダミー読み取り結果",
      occurred_on: occurredOn,
      metadata: {
        origin: "dummy-receipt-review"
      }
    })
    .select("id")
    .single();

  if (importGroupError || !importGroup) {
    redirect(receiptPath("create-error"));
  }

  const { error: draftError } = await supabase.from("expense_drafts").insert([
    {
      user_id: user.id,
      import_group_id: importGroup.id,
      line_index: 0,
      occurred_on: occurredOn,
      merchant_name: merchantName,
      title: "卵",
      amount: 238,
      suggested_category_id: foodCategoryId,
      note: null,
      source_type: "receipt",
      needs_review: false,
      raw_payload: {
        kind: "dummy"
      }
    },
    {
      user_id: user.id,
      import_group_id: importGroup.id,
      line_index: 1,
      occurred_on: occurredOn,
      merchant_name: merchantName,
      title: "洗剤 詰替",
      amount: 498,
      suggested_category_id: dailyCategoryId,
      note: null,
      source_type: "receipt",
      needs_review: false,
      raw_payload: {
        kind: "dummy"
      }
    },
    {
      user_id: user.id,
      import_group_id: importGroup.id,
      line_index: 2,
      occurred_on: occurredOn,
      merchant_name: merchantName,
      title: "商品が不明な明細",
      amount: null,
      suggested_category_id: null,
      note: "金額とカテゴリを確認してください。",
      source_type: "receipt",
      needs_review: true,
      raw_payload: {
        kind: "dummy"
      }
    }
  ]);

  if (draftError) {
    await supabase.from("import_groups").delete().eq("id", importGroup.id);
    redirect(receiptPath("create-error"));
  }

  revalidatePath(`/register/review/${importGroup.id}`);
  redirect(reviewPath(importGroup.id, "dummy-created"));
}

export async function createReceiptReviewFromUploadAction(formData: FormData) {
  const result = await createUploadReviewDrafts(formData, {
    sourceType: "receipt",
    metadataOrigin: "receipt-upload",
    fallbackTitle: "レシート読み取り結果"
  });

  if (!result.ok) {
    if (result.code === "unauthorized") {
      redirect("/login");
    }

    redirect(receiptPath(result.code));
  }

  revalidatePath(`/register/review/${result.importGroupId}`);
  redirect(reviewPath(result.importGroupId, "upload-created"));
}

export async function createCreditReviewFromUploadAction(formData: FormData) {
  const result = await createUploadReviewDrafts(formData, {
    sourceType: "credit_screenshot",
    metadataOrigin: "credit-screenshot-upload",
    fallbackTitle: "クレジット明細読み取り結果"
  });

  if (!result.ok) {
    if (result.code === "unauthorized") {
      redirect("/login");
    }

    redirect(creditPath(result.code));
  }

  revalidatePath(`/register/review/${result.importGroupId}`);
  redirect(reviewPath(result.importGroupId, "upload-created"));
}

export async function addDraftRowAction(formData: FormData) {
  const parsed = importGroupSchema.safeParse({
    importGroupId: formData.get("importGroupId")
  });

  if (!parsed.success) {
    redirect("/register");
  }

  const importGroupId = parsed.data.importGroupId;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: importGroup }, { data: lastDraft }] = await Promise.all([
    supabase
      .from("import_groups")
      .select("occurred_on, source_type, title")
      .eq("id", importGroupId)
      .single(),
    supabase
      .from("expense_drafts")
      .select("line_index")
      .eq("import_group_id", importGroupId)
      .order("line_index", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const { data: categories } = await supabase
    .from("categories")
    .select("id")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1);

  await supabase.from("expense_drafts").insert({
    user_id: user.id,
    import_group_id: importGroupId,
    line_index: (lastDraft?.line_index ?? -1) + 1,
    occurred_on: importGroup?.occurred_on,
    merchant_name: importGroup?.title ?? null,
    title: "新しい明細",
    amount: null,
    suggested_category_id: categories?.[0]?.id ?? null,
    note: null,
    source_type: importGroup?.source_type ?? "receipt",
    needs_review: true,
    raw_payload: {
      kind: "manual-review-add"
    }
  });

  revalidatePath(`/register/review/${importGroupId}`);
  redirect(reviewPath(importGroupId, "row-added"));
}

export async function updateDraftRowAction(formData: FormData) {
  const parsed = updateDraftSchema.safeParse({
    importGroupId: formData.get("importGroupId"),
    draftId: formData.get("draftId"),
    title: formData.get("title"),
    occurredOn: formData.get("occurredOn"),
    merchantName: formData.get("merchantName")?.toString() ?? "",
    amount: formData.get("amount"),
    categoryId: formData.get("categoryId"),
    note: formData.get("note")?.toString() ?? ""
  });

  if (!parsed.success) {
    const importGroupId = formData.get("importGroupId")?.toString() ?? "";
    redirect(reviewPath(importGroupId, "row-invalid"));
  }

  const { importGroupId, draftId, title, occurredOn, merchantName, amount, categoryId, note } =
    parsed.data;
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("expense_drafts")
    .update({
      occurred_on: occurredOn,
      merchant_name: merchantName || null,
      title,
      amount,
      suggested_category_id: categoryId,
      note: note || null,
      needs_review: deriveNeedsReview({ title, amount, categoryId })
    })
    .eq("id", draftId)
    .eq("import_group_id", importGroupId);

  if (error) {
    redirect(reviewPath(importGroupId, "row-save-error"));
  }

  revalidatePath(`/register/review/${importGroupId}`);
  redirect(reviewPath(importGroupId, "row-saved"));
}

export async function saveDraftRowAction(
  _prevState: ReviewDraftFormState,
  formData: FormData
): Promise<ReviewDraftFormState> {
  const values = {
    importGroupId: formData.get("importGroupId")?.toString() ?? "",
    draftId: formData.get("draftId")?.toString() ?? "",
    title: formData.get("title")?.toString() ?? "",
    occurredOn: formData.get("occurredOn")?.toString() ?? "",
    merchantName: formData.get("merchantName")?.toString() ?? "",
    amount: formData.get("amount")?.toString() ?? "",
    categoryId: formData.get("categoryId")?.toString() ?? "",
    note: formData.get("note")?.toString() ?? ""
  };

  const parsed = updateDraftSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors: ReviewDraftFormState["fieldErrors"] = {};

    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && isReviewDraftFieldName(field) && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }

    return {
      status: "error",
      message: "入力内容を確認してください。",
      fieldErrors,
      values
    };
  }

  const { importGroupId, draftId, title, occurredOn, merchantName, amount, categoryId, note } =
    parsed.data;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("expense_drafts")
    .update({
      occurred_on: occurredOn,
      merchant_name: merchantName || null,
      title,
      amount,
      suggested_category_id: categoryId,
      note: note || null,
      needs_review: deriveNeedsReview({ title, amount, categoryId })
    })
    .eq("id", draftId)
    .eq("import_group_id", importGroupId);

  if (error) {
    return {
      status: "error",
      message: "行を保存できませんでした。時間をおいて再度お試しください。",
      values
    };
  }

  revalidatePath(`/register/review/${importGroupId}`);

  return {
    status: "success",
    message: "この行を保存しました。",
    values: {
      ...values,
      occurredOn,
      merchantName: merchantName ?? "",
      title,
      amount: String(amount),
      categoryId,
      note: note ?? ""
    }
  };
}

export async function deleteDraftRowAction(formData: FormData) {
  const parsed = z
    .object({
      importGroupId: z.string().uuid(),
      draftId: z.string().uuid()
    })
    .safeParse({
      importGroupId: formData.get("importGroupId"),
      draftId: formData.get("draftId")
    });

  if (!parsed.success) {
    redirect("/register");
  }

  const { importGroupId, draftId } = parsed.data;
  const supabase = await createServerSupabaseClient();
  await supabase
    .from("expense_drafts")
    .delete()
    .eq("id", draftId)
    .eq("import_group_id", importGroupId);

  revalidatePath(`/register/review/${importGroupId}`);
  redirect(reviewPath(importGroupId, "row-deleted"));
}

export async function confirmDraftsAction(formData: FormData) {
  const parsed = importGroupSchema.safeParse({
    importGroupId: formData.get("importGroupId")
  });

  if (!parsed.success) {
    redirect("/register");
  }

  const importGroupId = parsed.data.importGroupId;
  const supabase = await createServerSupabaseClient();
  const draftsPayload = formData.get("draftsPayload")?.toString();

  if (draftsPayload) {
    let payload: unknown;

    try {
      payload = JSON.parse(draftsPayload);
    } catch {
      redirect(reviewPath(importGroupId, "confirm-error"));
    }

    const parsedPayload = z.array(bulkDraftItemSchema).safeParse(payload);

    if (!parsedPayload.success) {
      redirect(reviewPath(importGroupId, "confirm-error"));
    }

    for (const item of parsedPayload.data) {
      const normalizedAmount = Number(item.amount);

      if (!Number.isInteger(normalizedAmount) || normalizedAmount <= 0) {
        redirect(reviewPath(importGroupId, "confirm-error"));
      }

      const { error: updateError } = await supabase
        .from("expense_drafts")
        .update({
          occurred_on: item.occurredOn,
          merchant_name: item.merchantName || null,
          title: item.title,
          amount: normalizedAmount,
          suggested_category_id: item.categoryId,
          note: item.note || null,
          needs_review: deriveNeedsReview({
            title: item.title,
            amount: normalizedAmount,
            categoryId: item.categoryId
          })
        })
        .eq("id", item.draftId)
        .eq("import_group_id", importGroupId);

      if (updateError) {
        redirect(reviewPath(importGroupId, "confirm-error"));
      }
    }
  }

  const { error } = await supabase.rpc("confirm_import_group", {
    p_import_group_id: importGroupId
  });

  if (error) {
    redirect(reviewPath(importGroupId, "confirm-error"));
  }

  revalidatePath("/expenses");
  revalidatePath("/home");
  redirect("/expenses?created=1");
}

export async function discardImportGroupAction(formData: FormData) {
  const parsed = importGroupSchema.safeParse({
    importGroupId: formData.get("importGroupId")
  });

  if (!parsed.success) {
    redirect("/register");
  }

  const importGroupId = parsed.data.importGroupId;
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("delete_import_group", {
    p_import_group_id: importGroupId
  });

  if (error) {
    redirect(reviewPath(importGroupId, "discard-error"));
  }

  revalidatePath("/register");
  revalidatePath("/register/pending");
  revalidatePath("/home");
  redirect(registerPath("group-discarded"));
}

export async function deleteImportGroupAction(formData: FormData) {
  const parsed = importGroupSchema.safeParse({
    importGroupId: formData.get("importGroupId")
  });

  if (!parsed.success) {
    redirect("/expenses");
  }

  const importGroupId = parsed.data.importGroupId;
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("delete_import_group", {
    p_import_group_id: importGroupId
  });

  if (error) {
    redirect("/expenses?delete_error=1");
  }

  revalidatePath("/expenses");
  revalidatePath("/home");
  redirect("/expenses?deleted=1");
}

export async function deletePendingImportGroupAction(formData: FormData) {
  const parsed = importGroupSchema.safeParse({
    importGroupId: formData.get("importGroupId")
  });

  if (!parsed.success) {
    redirect("/register/pending");
  }

  const importGroupId = parsed.data.importGroupId;
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("delete_import_group", {
    p_import_group_id: importGroupId
  });

  if (error) {
    redirect(pendingPath("delete_error"));
  }

  revalidatePath("/register/pending");
  revalidatePath("/register");
  revalidatePath("/home");
  redirect(pendingPath("deleted"));
}
