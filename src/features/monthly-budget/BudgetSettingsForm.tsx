"use client";

import { useActionState } from "react";
import Link from "next/link";
import { SubmitButton } from "@/components/SubmitButton";
import { saveMonthlyBudgetAction } from "@/features/monthly-budget/actions";
import {
  createInitialMonthlyBudgetFormState,
  type MonthlyBudgetFormValues
} from "@/features/monthly-budget/form-state";
import type { CategoryOption } from "@/lib/finance/types";
import { formatCurrency } from "@/lib/utils/format";

type BudgetSettingsFormProps = {
  targetMonth: string;
  monthLabel: string;
  initialBudgetAmount: number | null;
  initialCategoryIds: string[];
  categories: CategoryOption[];
};

export function BudgetSettingsForm({
  targetMonth,
  monthLabel,
  initialBudgetAmount,
  initialCategoryIds,
  categories
}: BudgetSettingsFormProps) {
  const initialValues: MonthlyBudgetFormValues = {
    targetMonth,
    budgetAmount: initialBudgetAmount != null ? String(initialBudgetAmount) : "",
    categoryIds: initialCategoryIds
  };
  const [state, formAction] = useActionState(
    saveMonthlyBudgetAction,
    createInitialMonthlyBudgetFormState(initialValues)
  );

  return (
    <form action={formAction} className="field-stack">
      <input name="targetMonth" type="hidden" value={targetMonth} />

      <div className="field">
        <label htmlFor="budgetAmount">{monthLabel}の総予算額</label>
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
        <p className="field-hint">
          家賃などの固定費を除いた、変動費として見たい金額を入力してください。
        </p>
        {state.fieldErrors?.budgetAmount ? (
          <p className="error-text">{state.fieldErrors.budgetAmount}</p>
        ) : null}
      </div>

      <div className="field">
        <label>予算に含めるカテゴリ</label>
        <div className="checkbox-grid">
          {categories.map((category) => (
            <label className="checkbox-card" key={category.id}>
              <input
                defaultChecked={state.values.categoryIds.includes(category.id)}
                name="categoryIds"
                type="checkbox"
                value={category.id}
              />
              <span>{category.name}</span>
            </label>
          ))}
        </div>
        <p className="field-hint">
          選んだカテゴリだけを、今月の予算集計対象に含めます。あとから何度でも更新できます。
        </p>
      </div>

      {state.status === "error" ? <p className="error-text">{state.message}</p> : null}

      <div className="form-footer">
        <SubmitButton pendingLabel="保存中...">予算設定を保存</SubmitButton>
        <p className="caption">
          {initialBudgetAmount != null
            ? `現在の設定額は ${formatCurrency(initialBudgetAmount)} です。対象カテゴリもあわせて更新できます。`
            : "今月の総予算と対象カテゴリを登録すると、ホームで予算進捗を確認できます。"}
        </p>
        <Link className="button button-secondary" href="/home">
          ホームに戻る
        </Link>
      </div>
    </form>
  );
}
