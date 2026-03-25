"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { createReceiptReviewFromUploadAction } from "@/features/import-review/actions";

type SelectedFileItem = {
  id: string;
  name: string;
  type: string;
  size: number;
};

const MAX_UPLOAD_FILES = 3;
const MAX_TOTAL_UPLOAD_SIZE_BYTES = 7 * 1024 * 1024;
const TARGET_LONG_EDGE_PX = 1800;
const TARGET_JPEG_QUALITY = 0.78;
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
    size: file.size,
  };
}

function formatMegaBytes(size: number) {
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function renameToJpeg(name: string) {
  return name.replace(/\.[^.]+$/, "") + ".jpg";
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("画像の読み込みに失敗しました。"));
    };

    image.src = objectUrl;
  });
}

function canvasToJpegFile(
  canvas: HTMLCanvasElement,
  originalFile: File
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("画像の変換に失敗しました。"));
          return;
        }

        resolve(
          new File([blob], renameToJpeg(originalFile.name), {
            type: "image/jpeg",
            lastModified: Date.now(),
          })
        );
      },
      "image/jpeg",
      TARGET_JPEG_QUALITY
    );
  });
}

async function compressImageFile(file: File) {
  const image = await loadImageFromFile(file);
  const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
  const scale =
    longestEdge > TARGET_LONG_EDGE_PX ? TARGET_LONG_EDGE_PX / longestEdge : 1;

  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("画像変換に必要な canvas を利用できませんでした。");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return canvasToJpegFile(canvas, file);
}

async function prepareUploadFiles(files: File[]) {
  const preparedFiles: File[] = [];

  for (const file of files) {
    if (isUnsupportedHeicFile(file)) {
      throw new Error(
        "HEIC / HEIF 画像はまだ未対応です。iPhone の写真を JPEG または PNG に変換してからお試しください。"
      );
    }

    if (!file.type.startsWith("image/")) {
      throw new Error("画像ファイルのみアップロードできます。");
    }

    if (file.type === "image/gif") {
      preparedFiles.push(file);
      continue;
    }

    try {
      const compressed = await compressImageFile(file);
      preparedFiles.push(compressed.size < file.size ? compressed : file);
    } catch (error) {
      console.error("[receipt-upload] compression failed", {
        file: formatFileLog(file),
        error,
      });

      if (file.size > MAX_TOTAL_UPLOAD_SIZE_BYTES / 2) {
        throw new Error(
          "画像の変換に失敗しました。別の画像を使うか、画像サイズを小さくしてからお試しください。"
        );
      }

      preparedFiles.push(file);
    }
  }

  const totalSize = preparedFiles.reduce((sum, file) => sum + file.size, 0);

  if (totalSize > MAX_TOTAL_UPLOAD_SIZE_BYTES) {
    throw new Error(
      `送信サイズが大きすぎます。合計 ${formatMegaBytes(
        totalSize
      )} あるため、より小さい画像でお試しください。`
    );
  }

  return preparedFiles;
}

export function ReceiptUploadForm() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFileItem[]>([]);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const previewCountLabel = useMemo(
    () => `${selectedFiles.length}/3枚`,
    [selectedFiles.length]
  );
  const selectedTotalSize = useMemo(
    () => selectedFiles.reduce((sum, file) => sum + file.size, 0),
    [selectedFiles]
  );

  return (
    <form
      className="field-stack"
      data-testid="receipt-upload-form"
      onSubmit={(event) => {
        event.preventDefault();

        startTransition(async () => {
          try {
            setClientError(null);

            const files = Array.from(inputRef.current?.files ?? []).slice(
              0,
              MAX_UPLOAD_FILES
            );
            console.error(
              "[receipt-upload] submit files",
              files.map(formatFileLog)
            );

            if (files.length === 0) {
              setClientError("画像を1枚以上選択してください。");
              return;
            }

            const preparedFiles = await prepareUploadFiles(files);
            console.error(
              "[receipt-upload] prepared files",
              preparedFiles.map(formatFileLog)
            );

            const formData = new FormData();
            preparedFiles.forEach((file) =>
              formData.append("images", file, file.name)
            );

            await createReceiptReviewFromUploadAction(formData);
          } catch (error) {
            console.error("[receipt-upload] submit handler crashed", error);
            setClientError(
              error instanceof Error
                ? error.message
                : "アップロード中にエラーが発生しました。画像を選び直して、もう一度お試しください。"
            );
          }
        });
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

              const files = Array.from(event.currentTarget.files ?? []).slice(
                0,
                MAX_UPLOAD_FILES
              );
              console.error(
                "[receipt-upload] selected files",
                files.map(formatFileLog)
              );

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
                  size: file.size,
                }))
              );
            } catch (error) {
              console.error("[receipt-upload] selection handler crashed", error);
              setSelectedFiles([]);
              setClientError(
                "画像の読み込み時にエラーが発生しました。画像を選び直して、もう一度お試しください。"
              );
            }
          }}
          ref={inputRef}
          required
          type="file"
        />
        <p className="field-hint">
          1枚から3枚までのレシート画像を選択してください。現在:{" "}
          {previewCountLabel} / 合計 {formatMegaBytes(selectedTotalSize)}
        </p>
        {clientError ? <p className="error-text">{clientError}</p> : null}
      </div>

      {selectedFiles.length > 0 ? (
        <div className="upload-file-list">
          {selectedFiles.map((file) => (
            <div className="upload-file-row" key={file.id}>
              <strong>{file.name}</strong>
              <span>
                {file.type || "type unknown"} ・ {formatMegaBytes(file.size)}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="form-footer">
        <button
          className="button"
          data-testid="receipt-upload-submit"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "読み取り中..." : "読み取る"}
        </button>
      </div>
    </form>
  );
}
