import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { deleteExpenseAction } from "@/features/expenses/actions";

type ExpenseDeleteFormProps = {
  expenseId: string;
  occurredOn: string;
  title: string;
  returnTo?: string;
  className?: string;
};

export function ExpenseDeleteForm({
  expenseId,
  occurredOn,
  title,
  returnTo,
  className = "button button-secondary compact-button action-button action-button-secondary",
}: ExpenseDeleteFormProps) {
  return (
    <form action={deleteExpenseAction}>
      <input name="expenseId" type="hidden" value={expenseId} />
      <input name="occurredOn" type="hidden" value={occurredOn} />
      {returnTo ? <input name="returnTo" type="hidden" value={returnTo} /> : null}
      <ConfirmSubmitButton
        className={className}
        confirmationMessage={`「${title}」を削除しますか？`}
      >
        削除
      </ConfirmSubmitButton>
    </form>
  );
}
