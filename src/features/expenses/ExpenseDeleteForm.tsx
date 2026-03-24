import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { deleteExpenseAction } from "@/features/expenses/actions";

type ExpenseDeleteFormProps = {
  expenseId: string;
  occurredOn: string;
  title: string;
};

export function ExpenseDeleteForm({ expenseId, occurredOn, title }: ExpenseDeleteFormProps) {
  return (
    <form action={deleteExpenseAction}>
      <input name="expenseId" type="hidden" value={expenseId} />
      <input name="occurredOn" type="hidden" value={occurredOn} />
      <ConfirmSubmitButton
        className="button button-secondary compact-button"
        confirmationMessage={`「${title}」を削除しますか？`}
      >
        削除
      </ConfirmSubmitButton>
    </form>
  );
}
