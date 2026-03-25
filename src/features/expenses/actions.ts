"use server";

import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function dayPath(date: string, notice?: string) {
  return (notice
    ? `/expenses/day/${date}?notice=${encodeURIComponent(notice)}`
    : `/expenses/day/${date}`) as Route;
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime());
}

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

function revalidateExpenseSurfaces(date: string) {
  revalidatePath("/expenses");
  revalidatePath("/expenses/reports");
  revalidatePath("/expenses/history");
  revalidatePath("/home");
  revalidatePath("/home/categories");
  revalidatePath(`/expenses/day/${date}`);
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

  const { expenseId, occurredOn, categoryId } = parsed.data;
  const supabase = await createServerSupabaseClient();

  const { data: currentExpense, error: currentExpenseError } = await supabase
    .from("expenses")
    .select("suggested_category_id, category_id")
    .eq("id", expenseId)
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
      category_id: categoryId,
      is_category_corrected: isCategoryCorrected
    })
    .eq("id", expenseId);

  if (error) {
    redirect(dayPath(occurredOn, "expense_update_error"));
  }

  revalidateExpenseSurfaces(occurredOn);
  redirect(dayPath(occurredOn, "expense_updated"));
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

  const { expenseId, occurredOn, amount } = parsed.data;
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("expenses").update({ amount }).eq("id", expenseId);

  if (error) {
    redirect(dayPath(occurredOn, "expense_amount_error"));
  }

  revalidateExpenseSurfaces(occurredOn);
  redirect(dayPath(occurredOn, "expense_amount_updated"));
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
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);

  if (error) {
    redirect(dayPath(occurredOn, "expense_delete_error"));
  }

  revalidateExpenseSurfaces(occurredOn);
  redirect(dayPath(occurredOn, "expense_deleted"));
}
