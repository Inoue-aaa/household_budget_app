import type { SourceType } from "@/lib/finance/types";

export type OcrUploadSourceType = Extract<SourceType, "receipt" | "credit_screenshot">;
export type OcrProviderMode = "dummy" | "real" | "ollama_local";

export type OcrExtractionLine = {
  lineIndex: number;
  title: string;
  amount: number | null;
  merchantName?: string | null;
  occurredOn?: string | null;
  rawText?: string | null;
  rawPayload?: Record<string, unknown> | null;
};

export type OcrExtractionResult = {
  sourceType: OcrUploadSourceType;
  providerName: string;
  providerMode: OcrProviderMode;
  fallbackUsed: boolean;
  lines: OcrExtractionLine[];
};

export type OcrInputFile = {
  name: string;
  type: string;
  size: number;
  bytes: Uint8Array;
};

export type OcrProviderErrorCode =
  | "provider-unavailable"
  | "api-key-missing"
  | "request-failed"
  | "parse-failed"
  | "timeout";

export class OcrProviderError extends Error {
  code: OcrProviderErrorCode;

  constructor(code: OcrProviderErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "OcrProviderError";
  }
}
