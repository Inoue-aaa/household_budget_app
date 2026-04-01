"use client";

import { useActionState, useEffect, useState } from "react";
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

function RequiredMark() {
  return (
    <span aria-hidden="true" className="required-mark">
      *
    </span>
  );
}

export function ManualExpenseForm({
  categories,
  initialOccurredOn,
}: ManualExpenseFormProps) {
  const [state, formAction] = useActionState(
    createManualExpenseAction,
    initialManualExpenseFormState
  );
  const values = state.values;
  const [amount, setAmount] = useState(values.amount);
  const [baseAmount, setBaseAmount] = useState(values.amount);
  const [taxRate, setTaxRate] = useState<0 | 8 | 10>(0);

  useEffect(() => {
    setAmount(values.amount);
    setBaseAmount(values.amount);
    setTaxRate(0);
  }, [values.amount]);

  function applyTaxRate(rate: 0 | 8 | 10) {
    const sourceAmount = baseAmount || amount;
    const parsedAmount = Number(sourceAmount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return;
    }

    if (rate === 0) {
      setAmount(sourceAmount);
      setTaxRate(0);
      return;
    }

    setBaseAmount(sourceAmount);
    setAmount(String(Math.floor(parsedAmount * (1 + rate / 100))));
    setTaxRate(rate);
  }

  return (
    <form
      action={formAction}
      className="field-stack"
      data-testid="manual-expense-form"
    >
      <div className="field">
        <label htmlFor="occurredOn">
          日付 <RequiredMark />
        </label>
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
      </div>

      <div className="field">
        <label htmlFor="title">
          内容 <RequiredMark />
        </label>
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
        {state.fieldErrors?.title ? (
          <p className="error-text">{state.fieldErrors.title}</p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="amount">
          金額 <RequiredMark />
        </label>
        <input
          aria-invalid={Boolean(state.fieldErrors?.amount)}
          data-testid="manual-amount"
          id="amount"
          inputMode="numeric"
          min="1"
          name="amount"
          onChange={(event) => {
            setAmount(event.target.value);
            setBaseAmount(event.target.value);
            setTaxRate(0);
          }}
          placeholder="例: 1280"
          required
          step="1"
          type="number"
          value={amount}
        />
        <div className="tax-rate-picker" role="group" aria-label="税率">
          {([8, 10] as const).map((rate) => (
            <button
              aria-pressed={taxRate === rate}
              className={`tax-rate-chip${taxRate === rate ? " tax-rate-chip-active" : ""}`}
              key={rate}
              onClick={() => applyTaxRate(taxRate === rate ? 0 : rate)}
              type="button"
            >
              {rate}%
            </button>
          ))}
        </div>
        <p className="field-hint">1円以上の整数で入力します。</p>
        {state.fieldErrors?.amount ? (
          <p className="error-text">{state.fieldErrors.amount}</p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="categoryId">
          カテゴリ <RequiredMark />
        </label>
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

      {state.status === "error" ? (
        <p className="error-text">{state.message}</p>
      ) : null}

      <div className="form-footer">
        <SubmitButton pendingLabel="保存中..." testId="manual-submit">
          保存する
        </SubmitButton>
        <p className="caption">※保存後は支出一覧へ移動します。</p>
      </div>
    </form>
  );
}
