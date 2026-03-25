"use client";

import { useFormStatus } from "react-dom";
import { updateExpenseAmountAction } from "@/features/expenses/actions";
import type { ExpenseListItem } from "@/lib/finance/types";

type ExpenseAmountUpdateFormProps = {
  expense: ExpenseListItem;
};

function InlineSaveButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button button-secondary compact-button" disabled={pending} type="submit">
      {pending ? "保存中..." : "金額を更新"}
    </button>
  );
}

export function ExpenseAmountUpdateForm({ expense }: ExpenseAmountUpdateFormProps) {
  return (
    <form action={updateExpenseAmountAction} className="expense-inline-form">
      <input name="expenseId" type="hidden" value={expense.id} />
      <input name="occurredOn" type="hidden" value={expense.occurredOn} />
      <input
        aria-label="金額を更新"
        className="expense-inline-input"
        defaultValue={expense.amount}
        inputMode="numeric"
        min={1}
        name="amount"
        pattern="[0-9]*"
        required
        step={1}
        type="number"
      />
      <InlineSaveButton />
    </form>
  );
}
