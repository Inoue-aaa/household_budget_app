import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { deletePendingImportGroupAction } from "@/features/import-review/actions";
import { formatImportGroupDeleteConfirmation } from "@/lib/utils/format";

type PendingImportGroupDeleteFormProps = {
  importGroupId: string;
};

export function PendingImportGroupDeleteForm({
  importGroupId
}: PendingImportGroupDeleteFormProps) {
  return (
    <form action={deletePendingImportGroupAction}>
      <input name="importGroupId" type="hidden" value={importGroupId} />
      <ConfirmSubmitButton
        className="button button-secondary compact-button action-button action-button-secondary"
        confirmationMessage={formatImportGroupDeleteConfirmation()}
      >
        削除
      </ConfirmSubmitButton>
    </form>
  );
}
