"use client";

import { useFormStatus } from "react-dom";
import { updateExpenseCategoryAction } from "@/features/expenses/actions";
import type { CategoryOption, ExpenseListItem } from "@/lib/finance/types";

type ExpenseCategoryUpdateFormProps = {
  categories: CategoryOption[];
  expense: ExpenseListItem;
};

function InlineSaveButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button button-secondary compact-button" disabled={pending} type="submit">
      {pending ? "保存中..." : "カテゴリ変更"}
    </button>
  );
}

export function ExpenseCategoryUpdateForm({
  categories,
  expense
}: ExpenseCategoryUpdateFormProps) {
  return (
    <form action={updateExpenseCategoryAction} className="expense-inline-form">
      <input name="expenseId" type="hidden" value={expense.id} />
      <input name="occurredOn" type="hidden" value={expense.occurredOn} />
      <select
        aria-label="カテゴリ変更"
        className="expense-inline-select"
        defaultValue={expense.categoryId ?? categories[0]?.id ?? ""}
        name="categoryId"
      >
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <InlineSaveButton />
    </form>
  );
}
