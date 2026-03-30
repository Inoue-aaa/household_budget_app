"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthenticatedAccountContext } from "@/lib/accounts/queries";
import type { MonthlyBudgetFormState } from "@/features/monthly-budget/form-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const monthlyBudgetSchema = z.object({
  targetMonth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "対象月の形式が正しくありません。"),
  budgetAmount: z.coerce
    .number()
    .int("予算額は整数で入力してください。")
    .min(0, "予算額は0以上で入力してください。")
    .max(99_999_999, "予算額が大きすぎます。"),
  categoryIds: z.array(z.string().uuid()).default([])
});

export async function saveMonthlyBudgetAction(
  _prevState: MonthlyBudgetFormState,
  formData: FormData
): Promise<MonthlyBudgetFormState> {
  const values = {
    targetMonth: formData.get("targetMonth")?.toString() ?? "",
    budgetAmount: formData.get("budgetAmount")?.toString() ?? "",
    categoryIds: formData.getAll("categoryIds").map((value) => value.toString())
  };

  const parsed = monthlyBudgetSchema.safeParse(values);

  if (!parsed.success) {
    const fieldErrors: MonthlyBudgetFormState["fieldErrors"] = {};

    for (const issue of parsed.error.issues) {
      const field = issue.path[0];

      if (field === "budgetAmount" && !fieldErrors.budgetAmount) {
        fieldErrors.budgetAmount = issue.message;
      }
    }

    return {
      status: "error",
      message: "入力内容を確認してから、もう一度保存してください。",
      fieldErrors,
      values
    };
  }

  const supabase = await createServerSupabaseClient();
  const accountContext = await getAuthenticatedAccountContext();

  if (!accountContext) {
    return {
      status: "error",
      message: "ログイン状態を確認してから、もう一度お試しください。",
      values
    };
  }

  const categoryIds = Array.from(new Set(parsed.data.categoryIds));
  const { error } = await supabase.rpc("upsert_monthly_budget", {
    p_target_month: parsed.data.targetMonth,
    p_budget_amount: parsed.data.budgetAmount,
    p_category_ids: categoryIds
  });

  if (error) {
    return {
      status: "error",
      message: "予算設定の保存に失敗しました。時間をおいてから再度お試しください。",
      values
    };
  }

  redirect("/home?notice=budget_saved");
}
