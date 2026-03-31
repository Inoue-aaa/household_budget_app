"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import {
  createRecurringExpenseAction,
  updateRecurringExpenseAction,
} from "@/features/fixed-expenses/actions";
import {
  initialFixedExpenseFormState,
  type FixedExpenseFormState,
  type FixedExpenseFormValues,
} from "@/features/fixed-expenses/form-state";
import type { CategoryOption } from "@/lib/finance/types";

type FixedExpenseFormProps = {
  categories: CategoryOption[];
  mode?: "create" | "edit";
  recurringExpenseId?: string;
  initialValues?: Partial<FixedExpenseFormValues>;
  submitLabel?: string;
  pendingLabel?: string;
  footerMessage?: string;
};

function RequiredMark() {
  return (
    <span aria-hidden="true" className="required-mark">
      *
    </span>
  );
}

const scheduleDayOptions = Array.from({ length: 31 }, (_, index) => String(index + 1));

function buildInitialState(initialValues?: Partial<FixedExpenseFormValues>): FixedExpenseFormState {
  return {
    ...initialFixedExpenseFormState,
    values: {
      ...initialFixedExpenseFormState.values,
      ...initialValues,
    },
  };
}

export function FixedExpenseForm({
  categories,
  mode = "create",
  recurringExpenseId,
  initialValues,
  submitLabel = "保存する",
  pendingLabel = "保存中...",
  footerMessage = "※保存後は一覧画面へ移動します。",
}: FixedExpenseFormProps) {
  const action = mode === "edit" ? updateRecurringExpenseAction : createRecurringExpenseAction;
  const [state, formAction] = useActionState(action, buildInitialState(initialValues));
  const values = state.values;

  return (
    <form action={formAction} className="field-stack" data-testid="fixed-expense-form">
      {recurringExpenseId ? (
        <input name="recurringExpenseId" type="hidden" value={recurringExpenseId} />
      ) : null}

      <div className="field">
        <label htmlFor="name">
          名称 <RequiredMark />
        </label>
        <input
          aria-invalid={Boolean(state.fieldErrors?.name)}
          defaultValue={values.name}
          id="name"
          maxLength={120}
          name="name"
          placeholder="例: 家賃、Netflix、スマホ代"
          required
          type="text"
        />
        {state.fieldErrors?.name ? <p className="error-text">{state.fieldErrors.name}</p> : null}
      </div>

      <div className="field">
        <label htmlFor="amount">
          金額 <RequiredMark />
        </label>
        <input
          aria-invalid={Boolean(state.fieldErrors?.amount)}
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

      <div className="review-inline-grid review-inline-grid-compact">
        <div className="field">
          <label htmlFor="scheduleDay">
            反映日 <RequiredMark />
          </label>
          <select
            aria-invalid={Boolean(state.fieldErrors?.scheduleDay)}
            defaultValue={values.scheduleDay}
            id="scheduleDay"
            name="scheduleDay"
            required
          >
            {scheduleDayOptions.map((day) => (
              <option key={day} value={day}>
                {day}日
              </option>
            ))}
          </select>
          {state.fieldErrors?.scheduleDay ? (
            <p className="error-text">{state.fieldErrors.scheduleDay}</p>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="scheduleTime">
            反映時刻 <RequiredMark />
          </label>
          <input
            aria-invalid={Boolean(state.fieldErrors?.scheduleTime)}
            defaultValue={values.scheduleTime || "09:00"}
            id="scheduleTime"
            name="scheduleTime"
            required
            type="time"
          />
          {state.fieldErrors?.scheduleTime ? (
            <p className="error-text">{state.fieldErrors.scheduleTime}</p>
          ) : null}
        </div>
      </div>

      <p className="field-hint">
        毎月の反映日を設定します。31日を選んだ場合、31日がない月は月末日に反映されます。
      </p>

      <div className="field">
        <label htmlFor="memo">メモ</label>
        <textarea
          defaultValue={values.memo}
          id="memo"
          maxLength={300}
          name="memo"
          placeholder="任意"
        />
      </div>

      <div className="field">
        <label htmlFor="isActive">有効 / 無効</label>
        <label className="checkbox-card" htmlFor="isActive">
          <input
            defaultChecked={values.isActive !== "false"}
            id="isActive"
            name="isActive"
            type="checkbox"
            value="true"
          />
          <span>この固定費を有効にする</span>
        </label>
      </div>

      {state.status === "error" ? <p className="error-text">{state.message}</p> : null}

      <div className="form-footer">
        <SubmitButton pendingLabel={pendingLabel} testId="fixed-expense-submit">
          {submitLabel}
        </SubmitButton>
        <p className="caption">{footerMessage}</p>
      </div>
    </form>
  );
}
