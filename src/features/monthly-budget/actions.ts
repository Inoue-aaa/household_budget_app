"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthenticatedAccountContext } from "@/lib/accounts/queries";
import type { MonthlyBudgetFormState } from "@/features/monthly-budget/form-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const monthlyBudgetSchema = z.object({
  targetMonth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "対象月の形式を確認してください。"),
  budgetAmount: z.coerce
    .number()
    .int("予算額は整数で入力してください。")
    .min(0, "予算額は0以上で入力してください。")
    .max(99_999_999, "予算額が大きすぎます。"),
  usesCategoryBudgets: z.enum(["true", "false"]).default("true"),
  applyToFuture: z.enum(["true", "false"]).default("true"),
});

function parseCategoryBudgetEntries(formData: FormData) {
  const categoryBudgetMap = new Map<string, string>();

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("categoryBudget:")) {
      continue;
    }

    categoryBudgetMap.set(key.replace("categoryBudget:", ""), value.toString().trim());
  }

  return Array.from(categoryBudgetMap.entries()).map(([categoryId, amount]) => ({
    categoryId,
    amount,
  }));
}

export async function saveMonthlyBudgetAction(
  _prevState: MonthlyBudgetFormState,
  formData: FormData,
): Promise<MonthlyBudgetFormState> {
  const categoryBudgets = parseCategoryBudgetEntries(formData);
  const values = {
    targetMonth: formData.get("targetMonth")?.toString() ?? "",
    budgetAmount: formData.get("budgetAmount")?.toString() ?? "",
    usesCategoryBudgets: formData.get("usesCategoryBudgets")?.toString() ?? "false",
    applyToFuture: formData.get("applyToFuture")?.toString() ?? "false",
    categoryBudgets,
  };

  const parsed = monthlyBudgetSchema.safeParse(values);
  const fieldErrors: MonthlyBudgetFormState["fieldErrors"] = {};

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "budgetAmount" && !fieldErrors.budgetAmount) {
        fieldErrors.budgetAmount = issue.message;
      }
    }
  }

  const normalizedCategoryBudgets: { categoryId: string; budgetAmount: number }[] = [];

  if (values.usesCategoryBudgets === "true") {
    for (const entry of categoryBudgets) {
      if (!entry.amount) {
        continue;
      }

      const budgetAmount = Number(entry.amount);
      if (!Number.isFinite(budgetAmount) || !Number.isInteger(budgetAmount) || budgetAmount < 0) {
        fieldErrors.categoryBudgets ??= "カテゴリ別予算は0以上の整数で入力してください。";
        break;
      }

      if (budgetAmount > 0) {
        normalizedCategoryBudgets.push({
          categoryId: entry.categoryId,
          budgetAmount,
        });
      }
    }
  }

  if (!parsed.success || fieldErrors.categoryBudgets) {
    return {
      status: "error",
      message: "入力内容を確認してから、もう一度保存してください。",
      fieldErrors,
      values,
    };
  }

  const supabase = await createServerSupabaseClient();
  const accountContext = await getAuthenticatedAccountContext();

  if (!accountContext) {
    return {
      status: "error",
      message: "ログイン状態を確認してから、もう一度お試しください。",
      values,
    };
  }

  const { data: currentTemplate, error: templateFetchError } = await supabase
    .from("budget_templates")
    .select("id")
    .eq("account_id", accountContext.currentAccount.id)
    .eq("is_default", true)
    .maybeSingle();

  if (templateFetchError) {
    return {
      status: "error",
      message: "予算設定の読み込みに失敗しました。時間をおいてから、もう一度お試しください。",
      values,
    };
  }

  let templateId = currentTemplate?.id ?? null;

  if (parsed.data.applyToFuture === "true") {
    const templatePayload = {
      user_id: accountContext.userId,
      account_id: accountContext.currentAccount.id,
      name: "デフォルト予算",
      total_budget: parsed.data.budgetAmount,
      is_default: true,
    };

    const templateResult = currentTemplate?.id
      ? await supabase
          .from("budget_templates")
          .update(templatePayload)
          .eq("id", currentTemplate.id)
          .eq("account_id", accountContext.currentAccount.id)
          .select("id")
          .single()
      : await supabase.from("budget_templates").insert(templatePayload).select("id").single();

    if (templateResult.error || !templateResult.data) {
      return {
        status: "error",
        message: "予算テンプレートの保存に失敗しました。時間をおいてから、もう一度お試しください。",
        values,
      };
    }

    templateId = templateResult.data.id;

    await supabase.from("budget_template_categories").delete().eq("template_id", templateId);

    if (normalizedCategoryBudgets.length > 0) {
      const { error: templateCategoriesError } = await supabase
        .from("budget_template_categories")
        .insert(
          normalizedCategoryBudgets.map((entry) => ({
            template_id: templateId,
            category_id: entry.categoryId,
            budget_amount: entry.budgetAmount,
          })),
        );

      if (templateCategoriesError) {
        return {
          status: "error",
          message: "カテゴリ別予算の保存に失敗しました。時間をおいてから、もう一度お試しください。",
          values,
        };
      }
    }
  }

  const { data: currentMonthBudget, error: currentMonthFetchError } = await supabase
    .from("monthly_budgets")
    .select("id")
    .eq("account_id", accountContext.currentAccount.id)
    .eq("target_month", parsed.data.targetMonth)
    .maybeSingle();

  if (currentMonthFetchError) {
    return {
      status: "error",
      message: "今月の予算設定に失敗しました。時間をおいてから、もう一度お試しください。",
      values,
    };
  }

  const monthlyBudgetPayload = {
    user_id: accountContext.userId,
    account_id: accountContext.currentAccount.id,
    target_month: parsed.data.targetMonth,
    budget_amount: parsed.data.budgetAmount,
    template_id: templateId,
  };

  const monthlyBudgetResult = currentMonthBudget?.id
    ? await supabase
        .from("monthly_budgets")
        .update(monthlyBudgetPayload)
        .eq("id", currentMonthBudget.id)
        .eq("account_id", accountContext.currentAccount.id)
        .select("id")
        .single()
    : await supabase.from("monthly_budgets").insert(monthlyBudgetPayload).select("id").single();

  if (monthlyBudgetResult.error || !monthlyBudgetResult.data) {
    return {
      status: "error",
      message: "今月の予算設定に失敗しました。時間をおいてから、もう一度お試しください。",
      values,
    };
  }

  const monthlyBudgetId = monthlyBudgetResult.data.id;

  await supabase
    .from("monthly_budget_categories")
    .delete()
    .eq("monthly_budget_id", monthlyBudgetId);

  if (normalizedCategoryBudgets.length > 0) {
    const { error: monthlyCategoriesError } = await supabase
      .from("monthly_budget_categories")
      .insert(
        normalizedCategoryBudgets.map((entry) => ({
          monthly_budget_id: monthlyBudgetId,
          category_id: entry.categoryId,
          budget_amount: entry.budgetAmount,
        })),
      );

    if (monthlyCategoriesError) {
      return {
        status: "error",
        message: "今月のカテゴリ別予算に失敗しました。時間をおいてから、もう一度お試しください。",
        values,
      };
    }
  }

  redirect("/app?tab=home&notice=budget_saved");
}
