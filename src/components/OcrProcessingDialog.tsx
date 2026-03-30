"use client";

type OcrProcessingDialogProps = {
  open: boolean;
  title: string;
  description: string;
};

export function OcrProcessingDialog({
  open,
  title,
  description,
}: OcrProcessingDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="app-shell-loading-overlay ocr-processing-overlay" role="presentation">
      <div className="app-shell-loading-dialog ocr-processing-dialog" role="status" aria-live="polite">
        <span className="app-shell-loading-spinner" aria-hidden="true" />
        <p className="app-shell-loading-title">{title}</p>
        <p className="app-shell-loading-copy">{description}</p>
      </div>
    </div>
  );
}

