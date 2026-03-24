"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type {
  FieldName,
  ManualExpenseFormState,
  ManualExpenseFormValues
} from "@/features/manual-expenses/form-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRuleToken } from "@/lib/utils/text";

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime());
}

function isFutureDate(value: string) {
  const today = new Date();
  const todayString = new Date(today.getTime() - today.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);

  return value > todayString;
}

function toFormValues(input: {
  occurredOn: string;
  merchantName?: string;
  title: string;
  amount: number | string;
  categoryId: string;
  note?: string;
}): ManualExpenseFormValues {
  return {
    occurredOn: input.occurredOn,
    merchantName: input.merchantName ?? "",
    title: input.title,
    amount: String(input.amount),
    categoryId: input.categoryId,
    note: input.note ?? ""
  };
}

const manualExpenseSchema = z.object({
  occurredOn: z
    .string()
    .min(1, "日付を入力してください。")
    .refine(isValidDate, "正しい日付を入力してください。")
    .refine((value) => !isFutureDate(value), "未来日では登録できません。"),
  merchantName: z
    .string()
    .trim()
    .max(80, "店舗名は80文字以内で入力してください。")
    .optional(),
  title: z
    .string()
    .trim()
    .min(1, "内容を入力してください。")
    .max(120, "内容は120文字以内で入力してください。"),
  amount: z.coerce
    .number()
    .int("金額は整数で入力してください。")
    .positive("金額は1円以上で入力してください。")
    .max(9_999_999, "金額が大きすぎます。"),
  categoryId: z.string().uuid("カテゴリを選択してください。"),
  note: z.string().trim().max(300, "メモは300文字以内で入力してください。").optional()
});

export async function createManualExpenseAction(
  _prevState: ManualExpenseFormState,
  formData: FormData
): Promise<ManualExpenseFormState> {
  const values = {
    occurredOn: formData.get("occurredOn")?.toString() ?? "",
    merchantName: formData.get("merchantName")?.toString() ?? "",
    title: formData.get("title")?.toString() ?? "",
    amount: formData.get("amount")?.toString() ?? "",
    categoryId: formData.get("categoryId")?.toString() ?? "",
    note: formData.get("note")?.toString() ?? ""
  };
  const parsed = manualExpenseSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors: ManualExpenseFormState["fieldErrors"] = {};

    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as FieldName | undefined;
      if (field && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }

    return {
      status: "error",
      message: "入力内容を確認して、もう一度保存してください。",
      fieldErrors,
      values: {
        occurredOn: values.occurredOn,
        merchantName: values.merchantName,
        title: values.title,
        amount: values.amount,
        categoryId: values.categoryId,
        note: values.note
      }
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      message: "ログイン状態を確認できませんでした。もう一度ログインしてください。",
      values: toFormValues(parsed.data)
    };
  }

  const merchantName = parsed.data.merchantName?.trim() || null;
  const note = parsed.data.note?.trim() || null;

  const { data: importGroup, error: importGroupError } = await supabase
    .from("import_groups")
    .insert({
      user_id: user.id,
      source_type: "manual",
      status: "confirmed",
      title: merchantName ?? parsed.data.title,
      occurred_on: parsed.data.occurredOn,
      confirmed_at: new Date().toISOString(),
      metadata: {
        origin: "manual-form"
      }
    })
    .select("id")
    .single();

  if (importGroupError || !importGroup) {
    return {
      status: "error",
      message: "登録の準備に失敗しました。少し時間をおいて再試行してください。",
      values: toFormValues(parsed.data)
    };
  }

  const { error: expenseError } = await supabase.from("expenses").insert({
    user_id: user.id,
    import_group_id: importGroup.id,
    occurred_on: parsed.data.occurredOn,
    merchant_name: merchantName,
    title: parsed.data.title.trim(),
    amount: parsed.data.amount,
    suggested_category_id: parsed.data.categoryId,
    category_id: parsed.data.categoryId,
    note,
    source_type: "manual",
    is_category_corrected: false
  });

  if (expenseError) {
    await supabase.from("import_groups").delete().eq("id", importGroup.id);

    return {
      status: "error",
      message: "支出の保存に失敗しました。入力内容は保持されているので、そのまま再試行できます。",
      values: toFormValues(parsed.data)
    };
  }

  const normalizedItem = normalizeRuleToken(parsed.data.title);
  const normalizedMerchant = normalizeRuleToken(merchantName ?? "");
  const nowIso = new Date().toISOString();

  const { data: existingRule } = await supabase
    .from("classification_rules")
    .select("id, usage_count")
    .eq("user_id", user.id)
    .eq("normalized_item_name", normalizedItem)
    .eq("normalized_merchant_name", normalizedMerchant)
    .maybeSingle();

  if (existingRule) {
    await supabase
      .from("classification_rules")
      .update({
        category_id: parsed.data.categoryId,
        rule_source: "manual_entry",
        usage_count: existingRule.usage_count + 1,
        last_used_at: nowIso
      })
      .eq("id", existingRule.id);
  } else {
    await supabase.from("classification_rules").insert({
      user_id: user.id,
      normalized_item_name: normalizedItem,
      normalized_merchant_name: normalizedMerchant,
      category_id: parsed.data.categoryId,
      rule_source: "manual_entry",
      usage_count: 1,
      last_used_at: nowIso
    });
  }

  revalidatePath("/expenses");
  revalidatePath("/home");
  redirect("/expenses?created=1");
}
