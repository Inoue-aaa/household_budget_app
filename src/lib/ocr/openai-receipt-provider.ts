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
      title: normalizeWhitespace(item.title),
      amount: item.amount,
      kind: normalizeKind(item.kind),
      rawText: normalizeWhitespace(item.rawText)
    }))
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
                  text:
                    "You look at Japanese receipt images and return structured purchase data. Distinguish item rows, subtotal, tax, total, tendered amount, change, and unknown rows. Do not force uncertain rows into item."
                }
              ]
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text:
                    "Read these Japanese receipt images and return JSON only. Extract merchantName, occurredOn, and items[]. For each row, set kind to one of item, subtotal, tax, total, tendered, change, or unknown. Keep product names as close to the receipt text as possible. Do not replace them with generic words. Never label tendered or change as item. If a row is unclear, use unknown. Include rawText for each row when possible."
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
