"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { OcrProcessingDialog } from "@/components/OcrProcessingDialog";
import { SubmitButton } from "@/components/SubmitButton";
import { createCreditReviewFromUploadAction } from "@/features/import-review/actions";

type PreviewItem = {
  id: string;
  name: string;
  url: string;
};

function CreditProcessingDialog() {
  const { pending } = useFormStatus();

  return (
    <OcrProcessingDialog
      description="確認用の明細を準備しています。数秒かかることがあります。"
      open={pending}
      title="明細画像を読み取っています…"
    />
  );
}

export function CreditScreenshotUploadForm() {
  const [previews, setPreviews] = useState<PreviewItem[]>([]);
  const previewCountLabel = useMemo(
    () => `${previews.length}/3枚`,
    [previews.length],
  );

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  return (
    <form
      action={createCreditReviewFromUploadAction}
      className="field-stack"
      data-testid="credit-upload-form"
    >
      <div className="field">
        <label htmlFor="credit-images">画像を選択</label>
        <input
          accept="image/*"
          data-testid="credit-images"
          id="credit-images"
          multiple
          name="images"
          onChange={(event) => {
            previews.forEach((preview) => URL.revokeObjectURL(preview.url));

            const files = Array.from(event.currentTarget.files ?? []).slice(
              0,
              3,
            );
            const nextPreviews = files.map((file) => ({
              id: `${file.name}-${file.lastModified}`,
              name: file.name,
              url: URL.createObjectURL(file),
            }));

            setPreviews(nextPreviews);
          }}
          required
          type="file"
        />
        <p className="field-hint">現在: {previewCountLabel}</p>
      </div>

      {previews.length > 0 ? (
        <div className="upload-preview-grid">
          {previews.map((preview) => (
            <div className="upload-preview-card" key={preview.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={preview.name}
                className="upload-preview-image"
                src={preview.url}
              />
              <p className="upload-preview-name">{preview.name}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="form-footer">
        <SubmitButton
          pendingLabel="読み取り中..."
          testId="credit-upload-submit"
        >
          読み取る
        </SubmitButton>
      </div>

      <CreditProcessingDialog />
    </form>
  );
}
