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

const nullableAmountSchema = z.union([z.number().int(), z.string()]).nullable();

const receiptItemSchema = z.object({
  name: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  amount: nullableAmountSchema.optional(),
  quantity: nullableAmountSchema.optional(),
  unitPrice: nullableAmountSchema.optional(),
  originalAmount: nullableAmountSchema.optional(),
  discountAmount: nullableAmountSchema.optional(),
  finalAmount: nullableAmountSchema.optional(),
  categoryHint: z
    .enum(["food", "daily_goods", "medicine", "beauty", "clothing", "other"])
    .nullable()
    .optional(),
  confidence: z.union([z.number(), z.string()]).nullable().optional(),
  kind: z.enum(["item", "subtotal", "tax", "total", "tendered", "change", "unknown"]),
  rawText: z.string().nullable()
});

const unknownRowSchema = z.object({
  rawText: z.string().nullable(),
  reason: z.string().nullable().optional(),
  amount: nullableAmountSchema.optional()
});

const receiptResponseSchema = z.object({
  merchantName: z.string().nullable().optional(),
  occurredOn: z.string().nullable().optional(),
  items: z.array(receiptItemSchema),
  unknownRows: z.array(unknownRowSchema).optional(),
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
            name: { type: ["string", "null"] },
            title: { type: ["string", "null"] },
            amount: { type: ["integer", "string", "null"] },
            quantity: { type: ["integer", "string", "null"] },
            unitPrice: { type: ["integer", "string", "null"] },
            originalAmount: { type: ["integer", "string", "null"] },
            discountAmount: { type: ["integer", "string", "null"] },
            finalAmount: { type: ["integer", "string", "null"] },
            categoryHint: {
              type: ["string", "null"],
              enum: ["food", "daily_goods", "medicine", "beauty", "clothing", "other", null]
            },
            confidence: { type: ["number", "string", "null"] },
            kind: {
              type: "string",
              enum: ["item", "subtotal", "tax", "total", "tendered", "change", "unknown"]
            },
            rawText: { type: ["string", "null"] }
          },
        required: [
          "name",
          "title",
          "amount",
          "quantity",
          "unitPrice",
          "originalAmount",
          "discountAmount",
          "finalAmount",
          "categoryHint",
          "confidence",
          "kind",
          "rawText"
        ]
        }
      },
      unknownRows: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            rawText: { type: ["string", "null"] },
            reason: { type: ["string", "null"] },
            amount: { type: ["integer", "string", "null"] }
          },
          required: ["rawText", "reason", "amount"]
        }
      }
    },
  required: ["merchantName", "occurredOn", "items", "unknownRows", "rawText"]
} as const;

function normalizeKind(value: ReceiptAiItemKind): ReceiptAiItemKind {
  return value;
}

function pickNormalizedTitle(item: OllamaReceiptResponse["items"][number]) {
  return normalizeWhitespace(item.name) ?? normalizeWhitespace(item.title);
}

function pickPreferredAmount(item: OllamaReceiptResponse["items"][number]) {
  return item.finalAmount ?? item.originalAmount ?? item.amount ?? null;
}

function mapAiResult(data: OllamaReceiptResponse): ReceiptAiResult {
  return {
    merchantName: normalizeWhitespace(data.merchantName),
    occurredOn: normalizeWhitespace(data.occurredOn),
    rawText: normalizeWhitespace(data.rawText),
    items: data.items.map((item) => ({
      title: pickNormalizedTitle(item),
      amount: pickPreferredAmount(item),
      quantity: item.quantity ?? null,
      unitPrice: item.unitPrice ?? null,
      originalAmount: item.originalAmount ?? item.amount ?? null,
      discountAmount: item.discountAmount ?? null,
      finalAmount: item.finalAmount ?? item.amount ?? null,
      categoryHint: item.categoryHint ?? null,
      confidence: item.confidence ?? null,
      kind: normalizeKind(item.kind),
      rawText: normalizeWhitespace(item.rawText)
    })),
    unknownRows:
      data.unknownRows?.map((row) => ({
        rawText: normalizeWhitespace(row.rawText),
        reason: normalizeWhitespace(row.reason),
        amount: row.amount ?? null
      })) ?? []
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
        "You analyze Japanese receipt images and return structured JSON for a household budget app. Distinguish item rows, discount-like rows, subtotal, tax, total, tendered amount, change, and unknown rows. Treat rows containing 会員様割引, 会員値引, 値引, 割引, 特売, クーポン, or coupon as discount-like rows. If a discount-like row clearly belongs to the nearest previous product row, merge it into that product instead of emitting a separate item. Use discountAmount as a negative number and finalAmount = originalAmount + discountAmount. If the linkage is unclear, do not force it into item; place it in unknownRows or mark it unknown. Never classify tendered or change as item. Keep merchantName, occurredOn, rawText, and product names as close to the receipt text as possible.",
      userPrompt:
        "Read these Japanese receipt images and return JSON only. Return merchantName, occurredOn, items[], and unknownRows[] when helpful. For each item row, you may include name, rawText, quantity, unitPrice, originalAmount, discountAmount, finalAmount, categoryHint, and confidence. finalAmount should be preferred when you can determine the discount-adjusted amount. Keep product names close to the receipt text and never replace them with generic words. categoryHint should be conservative: use food for food/drinks only; use daily_goods for masks, tissues, detergent, toilet paper, soap, batteries, and stationery; use medicine for drugs and painkillers; use beauty for shampoo and cosmetics; use clothing for shirts, socks, and innerwear; otherwise use other. Do not classify masks as food. If the product name is too short or ambiguous, use other. For each row, set kind to one of item, subtotal, tax, total, tendered, change, or unknown. Never label tendered or change as item. If a row is unclear, use unknown or unknownRows instead of forcing it into item.",
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
