import { z } from "zod";
import type { OcrProvider, OcrRequest } from "@/lib/ocr/provider";
import {
  postprocessReceiptAiResult,
  type ReceiptAiItemKind,
  type ReceiptAiResult
} from "@/lib/ocr/receipt-postprocess";
import { OcrProviderError } from "@/lib/ocr/types";
import type { OcrExtractionResult } from "@/lib/ocr/types";
import { normalizeWhitespace, requestOllamaJson } from "@/lib/ocr/ollama-shared";

const receiptItemSchema = z.object({
  title: z.string().nullable(),
  amount: z.union([z.number().int(), z.string()]).nullable(),
  kind: z.enum(["item", "subtotal", "tax", "total", "tendered", "change", "unknown"]),
  rawText: z.string().nullable()
});

const receiptResponseSchema = z.object({
  merchantName: z.string().nullable().optional(),
  occurredOn: z.string().nullable().optional(),
  items: z.array(receiptItemSchema),
  rawText: z.string().nullable().optional()
});

type OllamaReceiptResponse = z.infer<typeof receiptResponseSchema>;

const RECEIPT_OCR_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    merchantName: { type: ["string", "null"] },
    occurredOn: { type: ["string", "null"] },
    rawText: { type: ["string", "null"] },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: ["string", "null"] },
          amount: { type: ["integer", "string", "null"] },
          kind: {
            type: "string",
            enum: ["item", "subtotal", "tax", "total", "tendered", "change", "unknown"]
          },
          rawText: { type: ["string", "null"] }
        },
        required: ["title", "amount", "kind", "rawText"]
      }
    }
  },
  required: ["merchantName", "occurredOn", "items", "rawText"]
} as const;

function normalizeKind(value: ReceiptAiItemKind): ReceiptAiItemKind {
  return value;
}

function mapAiResult(data: OllamaReceiptResponse): ReceiptAiResult {
  return {
    merchantName: normalizeWhitespace(data.merchantName),
    occurredOn: normalizeWhitespace(data.occurredOn),
    rawText: normalizeWhitespace(data.rawText),
    items: data.items.map((item) => ({
      title: normalizeWhitespace(item.title),
      amount: item.amount,
      kind: normalizeKind(item.kind),
      rawText: normalizeWhitespace(item.rawText)
    }))
  };
}

export class OllamaReceiptOcrProvider implements OcrProvider {
  async extract(request: OcrRequest): Promise<OcrExtractionResult> {
    if (request.sourceType !== "receipt") {
      throw new OcrProviderError(
        "provider-unavailable",
        "The Ollama receipt OCR provider only supports receipt."
      );
    }

    const payload = await requestOllamaJson({
      schema: RECEIPT_OCR_JSON_SCHEMA,
      systemPrompt:
        "You look at Japanese receipt images and return structured purchase data. Distinguish item rows, subtotal, tax, total, tendered amount, change, and unknown rows. Do not force uncertain rows into item.",
      userPrompt:
        "Read these Japanese receipt images and return JSON only. Extract merchantName, occurredOn, and items[]. For each row, set kind to one of item, subtotal, tax, total, tendered, change, or unknown. Keep product names as close to the receipt text as possible. Do not replace them with generic words. Never label tendered or change as item. If a row is unclear, use unknown. Include rawText for each row when possible.",
      images: request.files.map((file) => file.bytes)
    });

    const parsed = receiptResponseSchema.safeParse(payload);

    if (!parsed.success) {
      throw new OcrProviderError("parse-failed", "Ollama returned an invalid response shape.");
    }

    const lines = postprocessReceiptAiResult(mapAiResult(parsed.data), {
      provider: "ollama"
    });

    return {
      sourceType: "receipt",
      providerName: "ollama-receipt",
      providerMode: "ollama_local",
      fallbackUsed: false,
      lines
    };
  }
}
