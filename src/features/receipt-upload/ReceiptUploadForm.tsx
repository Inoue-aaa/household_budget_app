"use client";

import { useMemo, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { createReceiptReviewFromUploadAction } from "@/features/import-review/actions";

type SelectedFileItem = {
  id: string;
  name: string;
  type: string;
  size: number;
};

const MAX_UPLOAD_FILES = 3;
const UNSUPPORTED_IMAGE_TYPES = new Set(["image/heic", "image/heif"]);

function isUnsupportedHeicFile(file: File) {
  const loweredName = file.name.toLowerCase();
  const loweredType = file.type.toLowerCase();

  return (
    UNSUPPORTED_IMAGE_TYPES.has(loweredType) ||
    loweredName.endsWith(".heic") ||
    loweredName.endsWith(".heif")
  );
}

function formatFileLog(file: File) {
  return {
    name: file.name,
    type: file.type,
    size: file.size
  };
}

export function ReceiptUploadForm() {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFileItem[]>([]);
  const [clientError, setClientError] = useState<string | null>(null);
  const previewCountLabel = useMemo(() => `${selectedFiles.length}/3 枚`, [selectedFiles.length]);

  return (
    <form
      action={createReceiptReviewFromUploadAction}
      className="field-stack"
      data-testid="receipt-upload-form"
      onSubmit={(event) => {
        try {
          setClientError(null);
          const fileInput = event.currentTarget.elements.namedItem("images");

          if (!(fileInput instanceof HTMLInputElement)) {
            return;
          }

          const files = Array.from(fileInput.files ?? []).slice(0, MAX_UPLOAD_FILES);
          console.error("[receipt-upload] submit files", files.map(formatFileLog));

          const unsupportedHeicFile = files.find(isUnsupportedHeicFile);

          if (unsupportedHeicFile) {
            event.preventDefault();
            setClientError(
              "HEIC / HEIF 画像はまだ未対応です。iPhone の写真を JPEG または PNG に変換してからお試しください。"
            );
            console.error("[receipt-upload] blocked unsupported image", formatFileLog(unsupportedHeicFile));
          }
        } catch (error) {
          event.preventDefault();
          console.error("[receipt-upload] submit handler crashed", error);
          setClientError(
            "アップロード準備中にエラーが発生しました。画像を選び直して、もう一度お試しください。"
          );
        }
      }}
    >
      <div className="field">
        <label htmlFor="receipt-images">画像を選択</label>
        <input
          accept="image/jpeg,image/png,image/webp,image/gif"
          data-testid="receipt-images"
          id="receipt-images"
          multiple
          name="images"
          onChange={(event) => {
            try {
              setClientError(null);

              const files = Array.from(event.currentTarget.files ?? []).slice(0, MAX_UPLOAD_FILES);
              console.error("[receipt-upload] selected files", files.map(formatFileLog));

              const unsupportedHeicFile = files.find(isUnsupportedHeicFile);

              if (unsupportedHeicFile) {
                event.currentTarget.value = "";
                setSelectedFiles([]);
                setClientError(
                  "HEIC / HEIF 画像はまだ未対応です。iPhone の写真を JPEG または PNG に変換してからお試しください。"
                );
                console.error(
                  "[receipt-upload] unsupported image selected",
                  formatFileLog(unsupportedHeicFile)
                );
                return;
              }

              setSelectedFiles(
                files.map((file) => ({
                  id: `${file.name}-${file.lastModified}`,
                  name: file.name,
                  type: file.type,
                  size: file.size
                }))
              );
            } catch (error) {
              console.error("[receipt-upload] selection handler crashed", error);
              setSelectedFiles([]);
              setClientError(
                "画像の読み込み準備でエラーが発生しました。画像を選び直して、もう一度お試しください。"
              );
            }
          }}
          required
          type="file"
        />
        <p className="field-hint">
          1枚から3枚までのレシート画像を選択してください。現在: {previewCountLabel}
        </p>
        {clientError ? <p className="error-text">{clientError}</p> : null}
      </div>

      {selectedFiles.length > 0 ? (
        <div className="upload-file-list">
          {selectedFiles.map((file) => (
            <div className="upload-file-row" key={file.id}>
              <strong>{file.name}</strong>
              <span>
                {file.type || "type unknown"} ・ {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="form-footer">
        <SubmitButton pendingLabel="読み取り候補を作成中..." testId="receipt-upload-submit">
          読み取り候補を作成して確認画面へ進む
        </SubmitButton>
        <p className="caption">
          まずはアップロード成功を優先するため、iPhone Safari では画像プレビューを簡略化しています。
        </p>
      </div>
    </form>
  );
}
