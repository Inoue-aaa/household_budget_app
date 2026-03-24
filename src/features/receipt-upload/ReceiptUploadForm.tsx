"use client";

import { useEffect, useMemo, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { createReceiptReviewFromUploadAction } from "@/features/import-review/actions";

type PreviewItem = {
  id: string;
  name: string;
  url: string;
};

export function ReceiptUploadForm() {
  const [previews, setPreviews] = useState<PreviewItem[]>([]);
  const previewCountLabel = useMemo(() => `${previews.length}/3 枚`, [previews.length]);

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  return (
    <form
      action={createReceiptReviewFromUploadAction}
      className="field-stack"
      data-testid="receipt-upload-form"
    >
      <div className="field">
        <label htmlFor="receipt-images">画像を選択</label>
        <input
          accept="image/*"
          data-testid="receipt-images"
          id="receipt-images"
          multiple
          name="images"
          onChange={(event) => {
            previews.forEach((preview) => URL.revokeObjectURL(preview.url));

            const files = Array.from(event.currentTarget.files ?? []).slice(0, 3);
            const nextPreviews = files.map((file) => ({
              id: `${file.name}-${file.lastModified}`,
              name: file.name,
              url: URL.createObjectURL(file)
            }));

            setPreviews(nextPreviews);
          }}
          required
          type="file"
        />
        <p className="field-hint">
          1枚から3枚までのレシート画像を選択してください。現在: {previewCountLabel}
        </p>
      </div>

      {previews.length > 0 ? (
        <div className="upload-preview-grid">
          {previews.map((preview) => (
            <div className="upload-preview-card" key={preview.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={preview.name} className="upload-preview-image" src={preview.url} />
              <p className="upload-preview-name">{preview.name}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="form-footer">
        <SubmitButton pendingLabel="読み取り結果を作成中..." testId="receipt-upload-submit">
          読み取り結果を作成して確認画面へ進む
        </SubmitButton>
        <p className="caption">
          画像は読み取り処理にのみ使用し、確認前データの生成後に保持しません。
        </p>
      </div>
    </form>
  );
}
