import { z } from "zod";
import {
  getOpenAiApiKey,
  getOpenAiOcrTimeoutMs,
  getOpenAiReceiptOcrModel
} from "@/lib/utils/env";
import {
  postprocessReceiptAiResult,
  type ReceiptAiItemKind,
  type ReceiptAiResult
} from "@/lib/ocr/receipt-postprocess";
import type { OcrProvider, OcrRequest } from "@/lib/ocr/provider";
import { OcrProviderError } from "@/lib/ocr/types";
import type { OcrExtractionResult } from "@/lib/ocr/types";

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

type OpenAiReceiptResponse = z.infer<typeof receiptResponseSchema>;

type ResponseOutputContent = {
  text?: string;
};

type ResponseOutputItem = {
  content?: ResponseOutputContent[];
};

type ResponsesApiPayload = {
  output_text?: string;
  output?: ResponseOutputItem[];
};

const RECEIPT_SYSTEM_PROMPT =
  "You analyze Japanese receipt images and return structured JSON for a household budget app. Distinguish item rows, discount-like rows, subtotal, tax, total, tendered amount, change, and unknown rows. Treat rows containing 会員様割引, 会員値引, 値引, 割引, 特売, クーポン, or coupon as discount-like rows. If a discount-like row clearly belongs to the nearest previous product row, merge it into that product instead of emitting a separate item. Use discountAmount as a negative number and finalAmount = originalAmount + discountAmount. If the linkage is unclear, do not force it into item; place it in unknownRows or mark it unknown. Never classify tendered or change as item. Keep merchantName, occurredOn, rawText, and product names as close to the receipt text as possible.";

const RECEIPT_USER_PROMPT =
  "Read these Japanese receipt images and return JSON only. Return merchantName, occurredOn, items[], and unknownRows[] when helpful. For each item row, you may include name, rawText, quantity, unitPrice, originalAmount, discountAmount, finalAmount, categoryHint, and confidence. finalAmount should be preferred when you can determine the discount-adjusted amount. Keep product names close to the receipt text and never replace them with generic words. categoryHint should be conservative: use food for food/drinks only; use daily_goods for masks, tissues, detergent, toilet paper, soap, batteries, and stationery; use medicine for drugs and painkillers; use beauty for shampoo and cosmetics; use clothing for shirts, socks, and innerwear; otherwise use other. Do not classify masks as food. If the product name is too short or ambiguous, use other. For each row, set kind to one of item, subtotal, tax, total, tendered, change, or unknown. Never label tendered or change as item. If a row is unclear, use unknown or unknownRows instead of forcing it into item.";

const RECEIPT_OCR_JSON_SCHEMA = {
  name: "receipt_structured_rows",
  strict: true,
  schema: {
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
  }
} as const;

function toDataUrl(file: OcrRequest["files"][number]) {
  return `data:${file.type};base64,${Buffer.from(file.bytes).toString("base64")}`;
}

function extractOutputText(payload: unknown) {
  const typedPayload = payload as ResponsesApiPayload;

  if (typeof typedPayload.output_text === "string" && typedPayload.output_text.trim()) {
    return typedPayload.output_text;
  }

  const parts =
    typedPayload.output
      ?.flatMap((item) => item.content ?? [])
      ?.map((content) => content.text)
      ?.filter(
        (value: unknown): value is string => typeof value === "string" && value.trim().length > 0
      ) ?? [];

  return parts.join("\n").trim();
}

function normalizeWhitespace(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() || null;
}

function normalizeOccurredOn(value: string | null | undefined) {
  const raw = normalizeWhitespace(value);

  if (!raw) {
    return null;
  }

  const compact = raw.replace(/[./]/g, "-").replace(/\s+/g, "");
  const yyyyMmDdMatch = compact.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (yyyyMmDdMatch) {
    const [, year, month, day] = yyyyMmDdMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const mmDdMatch = compact.match(/^(\d{1,2})-(\d{1,2})$/);
  if (mmDdMatch) {
    const currentYear = new Date().getFullYear();
    const [, month, day] = mmDdMatch;
    return `${currentYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return null;
}

function normalizeKind(value: ReceiptAiItemKind): ReceiptAiItemKind {
  return value;
}

function pickNormalizedTitle(item: OpenAiReceiptResponse["items"][number]) {
  return normalizeWhitespace(item.name) ?? normalizeWhitespace(item.title);
}

function pickPreferredAmount(item: OpenAiReceiptResponse["items"][number]) {
  return item.finalAmount ?? item.originalAmount ?? item.amount ?? null;
}

function parseReceiptResponse(outputText: string): OpenAiReceiptResponse {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(outputText);
  } catch {
    throw new OcrProviderError("parse-failed", "OpenAI OCR returned invalid JSON.");
  }

  const parsed = receiptResponseSchema.safeParse(parsedJson);

  if (!parsed.success) {
    throw new OcrProviderError("parse-failed", "OpenAI OCR returned an invalid response shape.");
  }

  return parsed.data;
}

function mapAiResult(data: OpenAiReceiptResponse): ReceiptAiResult {
  return {
    merchantName: normalizeWhitespace(data.merchantName),
    occurredOn: normalizeOccurredOn(data.occurredOn),
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

export class OpenAiReceiptOcrProvider implements OcrProvider {
  async extract(request: OcrRequest): Promise<OcrExtractionResult> {
    if (request.sourceType !== "receipt") {
      throw new OcrProviderError(
        "provider-unavailable",
        "The OpenAI receipt OCR provider only supports receipt."
      );
    }

    const apiKey = getOpenAiApiKey();
    if (!apiKey) {
      throw new OcrProviderError("api-key-missing", "OPENAI_API_KEY is not configured.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getOpenAiOcrTimeoutMs());

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: getOpenAiReceiptOcrModel(),
          input: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text: RECEIPT_SYSTEM_PROMPT
                }
              ]
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: RECEIPT_USER_PROMPT
                },
                ...request.files.map((file) => ({
                  type: "input_image" as const,
                  image_url: toDataUrl(file)
                }))
              ]
            }
          ],
          text: {
            format: {
              type: "json_schema",
              ...RECEIPT_OCR_JSON_SCHEMA
            }
          }
        })
      });

      if (!response.ok) {
        throw new OcrProviderError(
          "request-failed",
          `OpenAI OCR request failed with status ${response.status}.`
        );
      }

      const payload = (await response.json()) as unknown;
      const outputText = extractOutputText(payload);

      if (!outputText) {
        throw new OcrProviderError("parse-failed", "OpenAI OCR returned no text output.");
      }

      const parsed = parseReceiptResponse(outputText);
      const lines = postprocessReceiptAiResult(mapAiResult(parsed), {
        provider: "openai"
      });

      return {
        sourceType: "receipt",
        providerName: "openai-receipt",
        providerMode: "real",
        fallbackUsed: false,
        lines
      };
    } catch (error) {
      if (error instanceof OcrProviderError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new OcrProviderError("timeout", "OpenAI OCR request timed out.");
      }

      throw new OcrProviderError("request-failed", "OpenAI OCR request failed.");
    } finally {
      clearTimeout(timeout);
    }
  }
}
