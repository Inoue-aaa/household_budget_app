"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthenticatedAccountContext } from "@/lib/accounts/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function dayPath(date: string, notice?: string) {
  return (notice
    ? `/expenses/day/${date}?notice=${encodeURIComponent(notice)}`
    : `/expenses/day/${date}`) as Route;
}

function resolveReturnPath(returnTo: FormDataEntryValue | null, fallbackDate: string, notice?: string) {
  const value = returnTo?.toString().trim();

  if (value && value.startsWith("/")) {
    const separator = value.includes("?") ? "&" : "?";
    return `${value}${notice ? `${separator}notice=${encodeURIComponent(notice)}` : ""}` as Route;
  }

  return dayPath(fallbackDate, notice);
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime());
}

const updateExpenseSchema = z.object({
  expenseId: z.string().uuid(),
  occurredOn: z.string().refine(isValidDate),
  categoryId: z.string().uuid(),
  amount: z.coerce
    .number({
      invalid_type_error: "金額を入力してください。"
    })
    .int("金額は整数で入力してください。")
    .positive("金額は1円以上で入力してください。")
});

const updateExpenseCategorySchema = z.object({
  expenseId: z.string().uuid(),
  occurredOn: z.string().refine(isValidDate),
  categoryId: z.string().uuid()
});

const updateExpenseAmountSchema = z.object({
  expenseId: z.string().uuid(),
  occurredOn: z.string().refine(isValidDate),
  amount: z.coerce
    .number({
      invalid_type_error: "金額を入力してください。"
    })
    .int("金額は整数で入力してください。")
    .positive("金額は1円以上で入力してください。")
});

const deleteExpenseSchema = z.object({
  expenseId: z.string().uuid(),
  occurredOn: z.string().refine(isValidDate)
});

async function updateExpenseFields({
  expenseId,
  occurredOn,
  amount,
  categoryId
}: {
  expenseId: string;
  occurredOn: string;
  amount: number;
  categoryId: string;
}) {
  const supabase = await createServerSupabaseClient();
  const accountContext = await getAuthenticatedAccountContext();

  if (!accountContext) {
    redirect("/login");
  }

  const { data: currentExpense, error: currentExpenseError } = await supabase
    .from("expenses")
    .select("suggested_category_id, category_id")
    .eq("id", expenseId)
    .eq("account_id", accountContext.currentAccount.id)
    .maybeSingle();

  if (currentExpenseError || !currentExpense) {
    redirect(dayPath(occurredOn, "expense_update_error"));
  }

  const isCategoryCorrected =
    currentExpense.suggested_category_id != null
      ? currentExpense.suggested_category_id !== categoryId
      : currentExpense.category_id !== categoryId;

  const { error } = await supabase
    .from("expenses")
    .update({
      amount,
      category_id: categoryId,
      is_category_corrected: isCategoryCorrected
    })
    .eq("id", expenseId)
    .eq("account_id", accountContext.currentAccount.id);

  if (error) {
    redirect(dayPath(occurredOn, "expense_update_error"));
  }

  redirect(dayPath(occurredOn, "expense_updated"));
}

export async function updateExpenseAction(formData: FormData) {
  const parsed = updateExpenseSchema.safeParse({
    expenseId: formData.get("expenseId"),
    occurredOn: formData.get("occurredOn"),
    categoryId: formData.get("categoryId"),
    amount: formData.get("amount")
  });

  if (!parsed.success) {
    const fallbackDate = formData.get("occurredOn")?.toString() ?? new Date().toISOString().slice(0, 10);
    redirect(dayPath(fallbackDate, "expense_update_error"));
  }

  await updateExpenseFields(parsed.data);
}

export async function updateExpenseCategoryAction(formData: FormData) {
  const parsed = updateExpenseCategorySchema.safeParse({
    expenseId: formData.get("expenseId"),
    occurredOn: formData.get("occurredOn"),
    categoryId: formData.get("categoryId")
  });

  if (!parsed.success) {
    const fallbackDate = formData.get("occurredOn")?.toString() ?? new Date().toISOString().slice(0, 10);
    redirect(dayPath(fallbackDate, "expense_update_error"));
  }

  const supabase = await createServerSupabaseClient();
  const accountContext = await getAuthenticatedAccountContext();

  if (!accountContext) {
    redirect("/login");
  }

  const { data: expense, error: expenseError } = await supabase
    .from("expenses")
    .select("amount")
    .eq("id", parsed.data.expenseId)
    .eq("account_id", accountContext.currentAccount.id)
    .maybeSingle();

  if (expenseError || !expense) {
    redirect(dayPath(parsed.data.occurredOn, "expense_update_error"));
  }

  await updateExpenseFields({
    ...parsed.data,
    amount: expense.amount
  });
}

export async function updateExpenseAmountAction(formData: FormData) {
  const parsed = updateExpenseAmountSchema.safeParse({
    expenseId: formData.get("expenseId"),
    occurredOn: formData.get("occurredOn"),
    amount: formData.get("amount")
  });

  if (!parsed.success) {
    const fallbackDate = formData.get("occurredOn")?.toString() ?? new Date().toISOString().slice(0, 10);
    redirect(dayPath(fallbackDate, "expense_amount_error"));
  }

  const supabase = await createServerSupabaseClient();
  const accountContext = await getAuthenticatedAccountContext();

  if (!accountContext) {
    redirect("/login");
  }

  const { data: expense, error: expenseError } = await supabase
    .from("expenses")
    .select("category_id")
    .eq("id", parsed.data.expenseId)
    .eq("account_id", accountContext.currentAccount.id)
    .maybeSingle();

  if (expenseError || !expense || !expense.category_id) {
    redirect(dayPath(parsed.data.occurredOn, "expense_amount_error"));
  }

  await updateExpenseFields({
    ...parsed.data,
    categoryId: expense.category_id
  });
}

export async function deleteExpenseAction(formData: FormData) {
  const parsed = deleteExpenseSchema.safeParse({
    expenseId: formData.get("expenseId"),
    occurredOn: formData.get("occurredOn")
  });

  if (!parsed.success) {
    const fallbackDate = formData.get("occurredOn")?.toString() ?? new Date().toISOString().slice(0, 10);
    redirect(dayPath(fallbackDate, "expense_delete_error"));
  }

  const { expenseId, occurredOn } = parsed.data;
  const returnPath = resolveReturnPath(formData.get("returnTo"), occurredOn, "expense_deleted");
  const supabase = await createServerSupabaseClient();
  const accountContext = await getAuthenticatedAccountContext();

  if (!accountContext) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("account_id", accountContext.currentAccount.id);

  if (error) {
    redirect(resolveReturnPath(formData.get("returnTo"), occurredOn, "expense_delete_error"));
  }

  redirect(returnPath);
}
