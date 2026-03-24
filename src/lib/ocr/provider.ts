import type {
  OcrExtractionResult,
  OcrInputFile,
  OcrProviderMode,
  OcrUploadSourceType
} from "@/lib/ocr/types";

export type OcrRequest = {
  sourceType: OcrUploadSourceType;
  files: OcrInputFile[];
};

export interface OcrProvider {
  extract(request: OcrRequest): Promise<OcrExtractionResult>;
}

function shiftDate(base: Date, offsetDays: number) {
  const copy = new Date(base);
  copy.setDate(copy.getDate() - offsetDays);
  return copy.toISOString().slice(0, 10);
}

function createResult(
  sourceType: OcrUploadSourceType,
  providerName: string,
  providerMode: OcrProviderMode,
  lines: OcrExtractionResult["lines"]
): OcrExtractionResult {
  return {
    sourceType,
    providerName,
    providerMode,
    fallbackUsed: false,
    lines
  };
}

export class DummyOcrProvider implements OcrProvider {
  async extract(request: OcrRequest): Promise<OcrExtractionResult> {
    const today = new Date();
    const lines =
      request.sourceType === "credit_screenshot"
        ? this.createCreditScreenshotLines(request.files, today)
        : this.createReceiptLines(request.files, today);

    return createResult(request.sourceType, "dummy", "dummy", lines);
  }

  private createReceiptLines(files: OcrInputFile[], baseDate: Date) {
    const receiptTemplates = [
      { title: "egg M size", amount: 238 },
      { title: "milk 1L", amount: 198 },
      { title: "detergent refill", amount: 498 },
      { title: "beer 350ml", amount: 1120 },
      { title: "unknown item", amount: null }
    ];

    const merchantName =
      files[0]?.name.replace(/\.[^.]+$/, "").slice(0, 32) || "sample-store";

    return files.length === 0
      ? []
      : files.flatMap((file, fileIndex) => {
          const first = receiptTemplates[(fileIndex * 2) % receiptTemplates.length];
          const second = receiptTemplates[(fileIndex * 2 + 1) % receiptTemplates.length];
          const occurredOn = shiftDate(baseDate, fileIndex);

          return [
            {
              lineIndex: fileIndex * 2,
              title: first.title,
              amount: first.amount,
              merchantName,
              occurredOn,
              rawText: `${file.name}:${merchantName}:${first.title}:${first.amount ?? "?"}:${occurredOn}`
            },
            {
              lineIndex: fileIndex * 2 + 1,
              title: second.title,
              amount: second.amount,
              merchantName,
              occurredOn,
              rawText: `${file.name}:${merchantName}:${second.title}:${second.amount ?? "?"}:${occurredOn}`
            }
          ];
        });
  }

  private createCreditScreenshotLines(files: OcrInputFile[], baseDate: Date) {
    const creditTemplates = [
      { merchantName: "JR East", amount: 1540, offsetDays: 0, title: "JR East charge" },
      { merchantName: "Amazon Marketplace", amount: 3280, offsetDays: 1, title: "Amazon charge" },
      { merchantName: "Matsumotokiyoshi", amount: 980, offsetDays: 2, title: "Matsukiyo charge" },
      { merchantName: "ENEOS", amount: 4200, offsetDays: 4, title: "ENEOS charge" },
      { merchantName: "statement needs review", amount: 6120, offsetDays: 6, title: "unclear statement" }
    ];

    return files.length === 0
      ? []
      : files.flatMap((file, fileIndex) => {
          const first = creditTemplates[(fileIndex * 2) % creditTemplates.length];
          const second = creditTemplates[(fileIndex * 2 + 1) % creditTemplates.length];

          return [
            {
              lineIndex: fileIndex * 2,
              title: first.title,
              amount: first.amount,
              merchantName: first.merchantName,
              occurredOn: shiftDate(baseDate, first.offsetDays),
              rawText: `${file.name}:${first.merchantName}:${first.amount}:${first.title}`
            },
            {
              lineIndex: fileIndex * 2 + 1,
              title: second.title,
              amount: second.amount,
              merchantName: second.merchantName,
              occurredOn: shiftDate(baseDate, second.offsetDays),
              rawText: `${file.name}:${second.merchantName}:${second.amount}:${second.title}`
            }
          ];
        });
  }
}
