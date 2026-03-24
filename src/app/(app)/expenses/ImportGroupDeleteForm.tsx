import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { deleteImportGroupAction } from "@/features/import-review/actions";
import type { SourceType } from "@/lib/finance/types";
import {
  formatImportGroupDeleteConfirmation,
  formatImportGroupDeleteLabel
} from "@/lib/utils/format";

type ImportGroupDeleteFormProps = {
  importGroupId: string;
  sourceType: SourceType;
};

export function ImportGroupDeleteForm({
  importGroupId,
  sourceType
}: ImportGroupDeleteFormProps) {
  return (
    <form action={deleteImportGroupAction}>
      <input name="importGroupId" type="hidden" value={importGroupId} />
      <ConfirmSubmitButton
        className="button button-secondary compact-button"
        confirmationMessage={formatImportGroupDeleteConfirmation(sourceType)}
        testId="expenses-group-delete"
      >
        {formatImportGroupDeleteLabel(sourceType)}
      </ConfirmSubmitButton>
    </form>
  );
}
