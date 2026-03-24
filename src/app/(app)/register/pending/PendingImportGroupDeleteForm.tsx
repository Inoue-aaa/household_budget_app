import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { deletePendingImportGroupAction } from "@/features/import-review/actions";
import type { SourceType } from "@/lib/finance/types";
import {
  formatImportGroupDeleteConfirmation,
  formatImportGroupDeleteLabel
} from "@/lib/utils/format";

type PendingImportGroupDeleteFormProps = {
  importGroupId: string;
  sourceType: SourceType;
};

export function PendingImportGroupDeleteForm({
  importGroupId,
  sourceType
}: PendingImportGroupDeleteFormProps) {
  return (
    <form action={deletePendingImportGroupAction}>
      <input name="importGroupId" type="hidden" value={importGroupId} />
      <ConfirmSubmitButton
        className="button button-secondary compact-button"
        confirmationMessage={formatImportGroupDeleteConfirmation(sourceType)}
      >
        {formatImportGroupDeleteLabel(sourceType)}
      </ConfirmSubmitButton>
    </form>
  );
}
