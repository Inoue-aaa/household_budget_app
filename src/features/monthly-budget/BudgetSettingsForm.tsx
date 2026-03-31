"use client";

import { useActionState, useMemo, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { saveMonthlyBudgetAction } from "@/features/monthly-budget/actions";
import {
  createInitialMonthlyBudgetFormState,
  type MonthlyBudgetFormValues,
} from "@/features/monthly-budget/form-state";
import type { BudgetCategoryAllocation, CategoryOption } from "@/lib/finance/types";
import { formatCurrency } from "@/lib/utils/format";

type BudgetSettingsFormProps = {
  targetMonth: string;
  monthLabel: string;
  initialBudgetAmount: number | null;
  initialCategoryBudgets: BudgetCategoryAllocation[];
  categories: CategoryOption[];
  tracksCategoryBudgets: boolean;
  focusCategoryId?: string | null;
};

function findInitialCategoryValue(
  categoryId: string,
  initialCategoryBudgets: BudgetCategoryAllocation[],
) {
  const matched = initialCategoryBudgets.find((item) => item.categoryId === categoryId);
  return matched ? String(matched.budgetAmount) : "";
}

export function BudgetSettingsForm({
  targetMonth,
  monthLabel,
  initialBudgetAmount,
  initialCategoryBudgets,
  categories,
  tracksCategoryBudgets,
  focusCategoryId,
}: BudgetSettingsFormProps) {
  const initialValues: MonthlyBudgetFormValues = {
    targetMonth,
    budgetAmount: initialBudgetAmount != null ? String(initialBudgetAmount) : "",
    usesCategoryBudgets: tracksCategoryBudgets ? "true" : "false",
    applyToFuture: "true",
    categoryBudgets: categories.map((category) => ({
      categoryId: category.id,
      amount: findInitialCategoryValue(category.id, initialCategoryBudgets),
    })),
  };

  const [state, formAction] = useActionState(
    saveMonthlyBudgetAction,
    createInitialMonthlyBudgetFormState(initialValues),
  );
  const [usesCategoryBudgets, setUsesCategoryBudgets] = useState(
    state.values.usesCategoryBudgets === "true",
  );
  const [applyToFuture, setApplyToFuture] = useState(
    state.values.applyToFuture !== "false",
  );

  const previousMonthExists = useMemo(
    () => initialCategoryBudgets.some((item) => item.previousBudgetAmount != null),
    [initialCategoryBudgets],
  );

  return (
    <form action={formAction} className="field-stack">
      <input name="targetMonth" type="hidden" value={targetMonth} />
      <input name="usesCategoryBudgets" type="hidden" value={usesCategoryBudgets ? "true" : "false"} />
      <input name="applyToFuture" type="hidden" value={applyToFuture ? "true" : "false"} />

      <div className="section-card-header-row">
        <label className="compact-check-card budget-template-check">
          <input
            checked={applyToFuture}
            onChange={(event) => setApplyToFuture(event.target.checked)}
            type="checkbox"
          />
          <span>来月にも引き継ぐ</span>
        </label>
      </div>

      <div className="field">
        <label htmlFor="budgetAmount">{monthLabel}の全体予算</label>
        <input
          aria-invalid={Boolean(state.fieldErrors?.budgetAmount)}
          defaultValue={state.values.budgetAmount}
          id="budgetAmount"
          inputMode="numeric"
          min="0"
          name="budgetAmount"
          placeholder="例: 50000"
          required
          step="1"
          type="number"
        />
        <p className="field-hint">今月の上限として使う予算を入力します。</p>
        {state.fieldErrors?.budgetAmount ? (
          <p className="error-text">{state.fieldErrors.budgetAmount}</p>
        ) : null}
      </div>

      <div className="field">
        <div className="section-card-header-row">
          <label>カテゴリ別予算</label>
          <label className="compact-check-card">
            <input
              checked={usesCategoryBudgets}
              onChange={(event) => setUsesCategoryBudgets(event.target.checked)}
              type="checkbox"
            />
            <span>カテゴリ別に管理する</span>
          </label>
        </div>
        <p className="field-hint">
          {usesCategoryBudgets
            ? "カテゴリごとの予算を設定します。31日を選んだ固定費も月末補正後の支出として自然に集計されます。"
            : "全体予算のみを管理します。カテゴリ別予算は保存されません。"}
        </p>

        {usesCategoryBudgets ? (
          <div className="field-stack">
            {categories.map((category) => {
              const currentValue =
                state.values.categoryBudgets.find((item) => item.categoryId === category.id)?.amount ?? "";
              const previousBudgetAmount =
                initialCategoryBudgets.find((item) => item.categoryId === category.id)?.previousBudgetAmount ??
                null;

              return (
                <div
                  className={`list-row budget-settings-category-row${focusCategoryId === category.id ? " budget-settings-category-row-focused" : ""}`}
                  id={`budget-category-${category.id}`}
                  key={category.id}
                >
                  <div className="budget-settings-category-main">
                    <p className="list-title">{category.name}</p>
                    {previousMonthExists ? (
                      <p className="list-meta budget-settings-category-previous">
                        先月 {formatCurrency(previousBudgetAmount ?? 0)}
                      </p>
                    ) : null}
                  </div>
                  <input
                    className="budget-category-input"
                    defaultValue={currentValue}
                    inputMode="numeric"
                    min="0"
                    name={`categoryBudget:${category.id}`}
                    placeholder="0"
                    step="1"
                    type="number"
                  />
                </div>
              );
            })}
          </div>
        ) : null}

        {state.fieldErrors?.categoryBudgets ? (
          <p className="error-text">{state.fieldErrors.categoryBudgets}</p>
        ) : null}
      </div>

      {state.status === "error" ? <p className="error-text">{state.message}</p> : null}

      <div className="form-footer">
        <SubmitButton pendingLabel="保存中...">予算設定を保存</SubmitButton>
        <p className="caption">
          {initialBudgetAmount != null
            ? `現在の全体予算は ${formatCurrency(initialBudgetAmount)} です。`
            : "予算を保存すると、ホームから進捗を確認できます。"}
        </p>
      </div>
    </form>
  );
}
