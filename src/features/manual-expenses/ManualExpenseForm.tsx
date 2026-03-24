"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { createManualExpenseAction } from "@/features/manual-expenses/actions";
import { initialManualExpenseFormState } from "@/features/manual-expenses/form-state";
import type { CategoryOption } from "@/lib/finance/types";

type ManualExpenseFormProps = {
  categories: CategoryOption[];
  initialOccurredOn?: string;
};

function todayString() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function ManualExpenseForm({ categories, initialOccurredOn }: ManualExpenseFormProps) {
  const [state, formAction] = useActionState(
    createManualExpenseAction,
    initialManualExpenseFormState
  );
  const values = state.values;

  return (
    <form action={formAction} className="field-stack" data-testid="manual-expense-form">
      <div className="field">
        <label htmlFor="occurredOn">日付</label>
        <input
          aria-invalid={Boolean(state.fieldErrors?.occurredOn)}
          data-testid="manual-occurred-on"
          defaultValue={values.occurredOn || initialOccurredOn || todayString()}
          id="occurredOn"
          name="occurredOn"
          required
          type="date"
        />
        <p className="field-hint">支出が発生した日付を入力します。</p>
        {state.fieldErrors?.occurredOn ? (
          <p className="error-text">{state.fieldErrors.occurredOn}</p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="merchantName">店舗名</label>
        <input
          autoComplete="organization"
          data-testid="manual-merchant-name"
          defaultValue={values.merchantName}
          id="merchantName"
          maxLength={80}
          name="merchantName"
          placeholder="例: スーパー"
          type="text"
        />
        <p className="field-hint">スーパー、ドラッグストア、交通機関名など。</p>
      </div>

      <div className="field">
        <label htmlFor="title">内容</label>
        <input
          aria-invalid={Boolean(state.fieldErrors?.title)}
          data-testid="manual-title"
          defaultValue={values.title}
          enterKeyHint="next"
          id="title"
          maxLength={120}
          name="title"
          placeholder="例: 卵、日用品、交通費"
          required
          type="text"
        />
        {state.fieldErrors?.title ? <p className="error-text">{state.fieldErrors.title}</p> : null}
      </div>

      <div className="field">
        <label htmlFor="amount">金額</label>
        <input
          aria-invalid={Boolean(state.fieldErrors?.amount)}
          data-testid="manual-amount"
          defaultValue={values.amount}
          id="amount"
          inputMode="numeric"
          min="1"
          name="amount"
          placeholder="例: 1280"
          required
          step="1"
          type="number"
        />
        <p className="field-hint">1円以上の整数で入力します。</p>
        {state.fieldErrors?.amount ? <p className="error-text">{state.fieldErrors.amount}</p> : null}
      </div>

      <div className="field">
        <label htmlFor="categoryId">カテゴリ</label>
        <select
          aria-invalid={Boolean(state.fieldErrors?.categoryId)}
          data-testid="manual-category-id"
          defaultValue={values.categoryId || categories[0]?.id || ""}
          id="categoryId"
          name="categoryId"
          required
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {state.fieldErrors?.categoryId ? (
          <p className="error-text">{state.fieldErrors.categoryId}</p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="note">メモ</label>
        <textarea
          data-testid="manual-note"
          defaultValue={values.note}
          id="note"
          maxLength={300}
          name="note"
          placeholder="任意"
        />
      </div>

      {state.status === "error" ? <p className="error-text">{state.message}</p> : null}

      <div className="form-footer">
        <SubmitButton pendingLabel="保存中..." testId="manual-submit">
          保存する
        </SubmitButton>
        <p className="caption">
          保存時に import_group と expense を同時に作成し、分類履歴にも反映します。
        </p>
      </div>
    </form>
  );
}
