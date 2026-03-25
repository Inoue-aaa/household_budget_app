import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { deleteImportGroupAction } from "@/features/import-review/actions";
import { formatImportGroupDeleteConfirmation } from "@/lib/utils/format";

type ImportGroupDeleteFormProps = {
  importGroupId: string;
  className?: string;
};

export function ImportGroupDeleteForm({
  importGroupId,
  className = "button button-secondary compact-button action-button action-button-secondary"
}: ImportGroupDeleteFormProps) {
  return (
    <form action={deleteImportGroupAction}>
      <input name="importGroupId" type="hidden" value={importGroupId} />
      <ConfirmSubmitButton
        className={className}
        confirmationMessage={formatImportGroupDeleteConfirmation()}
        testId="expenses-group-delete"
      >
        削除
      </ConfirmSubmitButton>
    </form>
  );
}
