"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthenticatedAccountContext } from "@/lib/accounts/queries";
import {
  initialFixedExpenseFormState,
  type FixedExpenseFieldName,
  type FixedExpenseFormState,
  type FixedExpenseFormValues,
} from "@/features/fixed-expenses/form-state";
import { computeNextScheduledAt } from "@/features/fixed-expenses/schedule";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { monthDateRange } from "@/lib/utils/format";

function recurringExpensesPath(notice?: string) {
  return (notice
    ? `/register/fixed/list?notice=${encodeURIComponent(notice)}`
    : "/register/fixed/list") as Route;
}

function registerPath(notice?: string) {
  return (notice ? `/app?tab=register&notice=${encodeURIComponent(notice)}` : "/app?tab=register") as Route;
}

function toValues(input: {
  name?: string;
  amount?: string | number;
  categoryId?: string;
  scheduleDay?: string | number;
  scheduleTime?: string;
  memo?: string;
  isActive?: boolean | string;
}): FixedExpenseFormValues {
  return {
    name: input.name ?? "",
    amount: input.amount != null ? String(input.amount) : "",
    categoryId: input.categoryId ?? "",
    scheduleDay: input.scheduleDay != null ? String(input.scheduleDay) : "1",
    scheduleTime: input.scheduleTime ?? "09:00",
    memo: input.memo ?? "",
    isActive:
      typeof input.isActive === "boolean"
        ? String(input.isActive)
        : (input.isActive ?? "true"),
  };
}

const recurringExpenseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "名称を入力してください。")
    .max(120, "名称は120文字以内で入力してください。"),
  amount: z.coerce
    .number()
    .int("金額は整数で入力してください。")
    .positive("金額は1円以上で入力してください。")
    .max(9_999_999, "金額が大きすぎます。"),
  categoryId: z.string().uuid("カテゴリを選択してください。"),
  scheduleDay: z.coerce
    .number()
    .int("反映日は整数で入力してください。")
    .min(1, "反映日は1日から選択してください。")
    .max(31, "反映日は31日まで選択できます。"),
  scheduleTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "反映時刻を選択してください。"),
  memo: z
    .string()
    .trim()
    .max(300, "メモは300文字以内で入力してください。")
    .optional(),
  isActive: z.enum(["true", "false"]).default("true"),
});

function parseFieldErrors(values: {
  name: string;
  amount: string;
  categoryId: string;
  scheduleDay: string;
  scheduleTime: string;
  memo: string;
  isActive: string;
}) {
  const parsed = recurringExpenseSchema.safeParse(values);

  if (parsed.success) {
    return { parsed, fieldErrors: {} as FixedExpenseFormState["fieldErrors"] };
  }

  const fieldErrors: FixedExpenseFormState["fieldErrors"] = {};

  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as FixedExpenseFieldName | undefined;
    if (field && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return { parsed, fieldErrors };
}

function getFormValues(formData: FormData) {
  return {
    name: formData.get("name")?.toString() ?? "",
    amount: formData.get("amount")?.toString() ?? "",
    categoryId: formData.get("categoryId")?.toString() ?? "",
    scheduleDay: formData.get("scheduleDay")?.toString() ?? "1",
    scheduleTime: formData.get("scheduleTime")?.toString() ?? "09:00",
    memo: formData.get("memo")?.toString() ?? "",
    isActive: formData.get("isActive")?.toString() ?? "false",
  };
}

async function upsertRecurringExpense(
  values: FixedExpenseFormValues,
  recurringExpenseId?: string,
): Promise<FixedExpenseFormState | null> {
  const { parsed, fieldErrors } = parseFieldErrors(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "入力内容を確認して、もう一度保存してください。",
      fieldErrors,
      values: toValues(values),
    };
  }

  const accountContext = await getAuthenticatedAccountContext();

  if (!accountContext) {
    return {
      status: "error",
      message: "ログイン状態を確認できませんでした。もう一度ログインしてください。",
      values: toValues(parsed.data),
    };
  }

  const supabase = await createServerSupabaseClient();
  const memo = parsed.data.memo?.trim() || null;
  const scheduleTime = parsed.data.scheduleTime.length === 5
    ? `${parsed.data.scheduleTime}:00`
    : parsed.data.scheduleTime;
  const nextScheduledAt = computeNextScheduledAt({
    schedule_day: parsed.data.scheduleDay,
    schedule_time: scheduleTime,
    start_date: null,
    end_date: null,
  });

  const payload = {
    user_id: accountContext.userId,
    account_id: accountContext.currentAccount.id,
    name: parsed.data.name.trim(),
    amount: parsed.data.amount,
    category_id: parsed.data.categoryId,
    schedule_day: parsed.data.scheduleDay,
    schedule_time: scheduleTime,
    memo,
    is_active: parsed.data.isActive === "true",
    next_scheduled_at: parsed.data.isActive === "true" ? nextScheduledAt : null,
  };

  const query = recurringExpenseId
    ? supabase
        .from("recurring_expenses")
        .update(payload)
        .eq("id", recurringExpenseId)
        .eq("account_id", accountContext.currentAccount.id)
    : supabase.from("recurring_expenses").insert(payload);

  const { error } = await query;

  if (error) {
    return {
      status: "error",
      message: "固定費の保存に失敗しました。時間をおいてから再度お試しください。",
      values: toValues(parsed.data),
    };
  }

  return null;
}

export async function createRecurringExpenseAction(
  prevState: FixedExpenseFormState = initialFixedExpenseFormState,
  formData: FormData,
): Promise<FixedExpenseFormState> {
  void prevState;
  const values = getFormValues(formData);
  const result = await upsertRecurringExpense(values);

  if (result) {
    return result;
  }

  redirect(recurringExpensesPath("fixed-expense-created"));
}

export async function updateRecurringExpenseAction(
  prevState: FixedExpenseFormState = initialFixedExpenseFormState,
  formData: FormData,
): Promise<FixedExpenseFormState> {
  void prevState;
  const recurringExpenseId = formData.get("recurringExpenseId")?.toString() ?? "";

  if (!recurringExpenseId) {
    return {
      status: "error",
      message: "編集対象の固定費が見つかりませんでした。",
      values: toValues(getFormValues(formData)),
    };
  }

  const values = getFormValues(formData);
  const result = await upsertRecurringExpense(values, recurringExpenseId);

  if (result) {
    return result;
  }

  redirect(recurringExpensesPath("fixed-expense-updated"));
}

const toggleRecurringExpenseSchema = z.object({
  recurringExpenseId: z.string().uuid(),
  isActive: z.enum(["true", "false"]),
});

export async function toggleRecurringExpenseActiveAction(formData: FormData) {
  const parsed = toggleRecurringExpenseSchema.safeParse({
    recurringExpenseId: formData.get("recurringExpenseId"),
    isActive: formData.get("isActive"),
  });

  if (!parsed.success) {
    redirect(recurringExpensesPath("fixed-expense-toggle-error"));
  }

  const accountContext = await getAuthenticatedAccountContext();
  if (!accountContext) {
    redirect("/login");
  }

  const supabase = await createServerSupabaseClient();
  const isActive = parsed.data.isActive === "true";

  const { data: current, error: currentError } = await supabase
    .from("recurring_expenses")
    .select("schedule_day, schedule_time, start_date, end_date")
    .eq("id", parsed.data.recurringExpenseId)
    .eq("account_id", accountContext.currentAccount.id)
    .maybeSingle();

  if (currentError || !current) {
    redirect(recurringExpensesPath("fixed-expense-toggle-error"));
  }

  const { error } = await supabase
    .from("recurring_expenses")
    .update({
      is_active: isActive,
      next_scheduled_at: isActive ? computeNextScheduledAt(current) : null,
    })
    .eq("id", parsed.data.recurringExpenseId)
    .eq("account_id", accountContext.currentAccount.id);

  if (error) {
    redirect(recurringExpensesPath("fixed-expense-toggle-error"));
  }

  redirect(recurringExpensesPath("fixed-expense-toggled"));
}

const deleteRecurringExpenseSchema = z.object({
  recurringExpenseId: z.string().uuid(),
});

const addRecurringExpenseCandidateSchema = z.object({
  recurringExpenseId: z.string().uuid(),
});

export async function deleteRecurringExpenseAction(formData: FormData) {
  const parsed = deleteRecurringExpenseSchema.safeParse({
    recurringExpenseId: formData.get("recurringExpenseId"),
  });

  if (!parsed.success) {
    redirect(recurringExpensesPath("fixed-expense-delete-error"));
  }

  const accountContext = await getAuthenticatedAccountContext();
  if (!accountContext) {
    redirect("/login");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("recurring_expenses")
    .delete()
    .eq("id", parsed.data.recurringExpenseId)
    .eq("account_id", accountContext.currentAccount.id);

  if (error) {
    redirect(recurringExpensesPath("fixed-expense-delete-error"));
  }

  redirect(recurringExpensesPath("fixed-expense-deleted"));
}

export async function addRecurringExpenseCandidateAction(formData: FormData) {
  const parsed = addRecurringExpenseCandidateSchema.safeParse({
    recurringExpenseId: formData.get("recurringExpenseId"),
  });

  if (!parsed.success) {
    redirect(registerPath("fixed-expense-add-error"));
  }

  const accountContext = await getAuthenticatedAccountContext();
  if (!accountContext) {
    redirect("/login");
  }

  const supabase = await createServerSupabaseClient();
  const { data: recurringExpense, error: recurringExpenseError } = await supabase
    .from("recurring_expenses")
    .select(
      "id, category_id, name, amount, memo, schedule_day, schedule_time, is_active, start_date, end_date",
    )
    .eq("id", parsed.data.recurringExpenseId)
    .eq("account_id", accountContext.currentAccount.id)
    .eq("is_active", true)
    .maybeSingle();

  if (recurringExpenseError || !recurringExpense) {
    redirect(registerPath("fixed-expense-add-error"));
  }

  const now = new Date();
  const monthPrefix = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 7);
  const { start, end } = monthDateRange(new Date(`${monthPrefix}-01T00:00:00`));
  const occurredOn = `${monthPrefix}-${String(
    Math.min(
      recurringExpense.schedule_day,
      new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    ),
  ).padStart(2, "0")}`;

  if (
    (recurringExpense.start_date && occurredOn < recurringExpense.start_date) ||
    (recurringExpense.end_date && occurredOn > recurringExpense.end_date)
  ) {
    redirect(registerPath("fixed-expense-add-error"));
  }

  const { data: existingExpense } = await supabase
    .from("expenses")
    .select("id")
    .eq("account_id", accountContext.currentAccount.id)
    .eq("recurring_expense_id", recurringExpense.id)
    .gte("occurred_on", start)
    .lte("occurred_on", end)
    .maybeSingle();

  if (existingExpense) {
    redirect(registerPath("fixed-expense-already-added"));
  }

  const { data: importGroup, error: importGroupError } = await supabase
    .from("import_groups")
    .insert({
      user_id: accountContext.userId,
      account_id: accountContext.currentAccount.id,
      recurring_expense_id: recurringExpense.id,
      source_type: "manual",
      status: "confirmed",
      title: recurringExpense.name,
      occurred_on: occurredOn,
      confirmed_at: new Date().toISOString(),
      metadata: {
        origin: "recurring-candidate",
      },
    })
    .select("id")
    .single();

  if (importGroupError || !importGroup) {
    redirect(registerPath("fixed-expense-add-error"));
  }

  const { error: expenseError } = await supabase.from("expenses").insert({
    user_id: accountContext.userId,
    account_id: accountContext.currentAccount.id,
    import_group_id: importGroup.id,
    recurring_expense_id: recurringExpense.id,
    occurred_on: occurredOn,
    merchant_name: null,
    title: recurringExpense.name,
    amount: recurringExpense.amount,
    suggested_category_id: recurringExpense.category_id,
    category_id: recurringExpense.category_id,
    note: recurringExpense.memo,
    source_type: "manual",
    is_category_corrected: false,
  });

  if (expenseError) {
    await supabase.from("import_groups").delete().eq("id", importGroup.id);
    redirect(registerPath("fixed-expense-add-error"));
  }

  redirect(registerPath("fixed-expense-added"));
}
