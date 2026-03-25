"use client";

import { useFormStatus } from "react-dom";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { deleteExpenseAction, updateExpenseAction } from "@/features/expenses/actions";
import type { CategoryOption, ExpenseListItem } from "@/lib/finance/types";

type ExpenseEditFormProps = {
  categories: CategoryOption[];
  expense: ExpenseListItem;
};

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="button compact-button action-button action-button-primary"
      disabled={pending}
      type="submit"
    >
      {pending ? "保存中..." : "保存"}
    </button>
  );
}

export function ExpenseEditForm({ categories, expense }: ExpenseEditFormProps) {
  return (
    <form action={updateExpenseAction} className="expense-edit-form">
      <input name="expenseId" type="hidden" value={expense.id} />
      <input name="occurredOn" type="hidden" value={expense.occurredOn} />

      <div className="expense-edit-grid">
        <div className="field expense-edit-field">
          <label htmlFor={`expense-amount-${expense.id}`}>金額</label>
          <input
            className="expense-inline-input expense-edit-control"
            defaultValue={expense.amount}
            id={`expense-amount-${expense.id}`}
            inputMode="numeric"
            min={1}
            name="amount"
            pattern="[0-9]*"
            required
            step={1}
            type="number"
          />
        </div>

        <div className="field expense-edit-field">
          <label htmlFor={`expense-category-${expense.id}`}>カテゴリ</label>
          <select
            className="expense-inline-select expense-edit-control"
            defaultValue={expense.categoryId ?? categories[0]?.id ?? ""}
            id={`expense-category-${expense.id}`}
            name="categoryId"
            required
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="action-button-row action-button-row-centered expense-card-action-row expense-edit-actions">
        <ConfirmSubmitButton
          className="button button-secondary compact-button action-button action-button-secondary"
          confirmationMessage={`「${expense.title}」を削除しますか？`}
          formAction={deleteExpenseAction}
        >
          削除
        </ConfirmSubmitButton>
        <SaveButton />
      </div>
    </form>
  );
}
