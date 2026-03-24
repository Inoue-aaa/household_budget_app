import { z } from "zod";
import {
  getOpenAiApiKey,
  getOpenAiCreditOcrModel,
  getOpenAiOcrTimeoutMs
} from "@/lib/utils/env";
import type { OcrProvider, OcrRequest } from "@/lib/ocr/provider";
import { OcrProviderError } from "@/lib/ocr/types";
import type { OcrExtractionLine, OcrExtractionResult } from "@/lib/ocr/types";

const creditRowSchema = z.object({
  merchantName: z.string().nullable(),
  occurredOn: z.string().nullable(),
  amount: z.number().int().nullable(),
  title: z.string().nullable(),
  rawText: z.string().nullable()
});

const creditResponseSchema = z.object({
  entries: z.array(creditRowSchema)
});

type OpenAiCreditRow = z.infer<typeof creditRowSchema>;
type OpenAiCreditResponse = z.infer<typeof creditResponseSchema>;

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

const CREDIT_OCR_JSON_SCHEMA = {
  name: "credit_statement_rows",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      entries: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            merchantName: { type: ["string", "null"] },
            occurredOn: { type: ["string", "null"] },
            amount: { type: ["integer", "null"] },
            title: { type: ["string", "null"] },
            rawText: { type: ["string", "null"] }
          },
          required: ["merchantName", "occurredOn", "amount", "title", "rawText"]
        }
      }
    },
    required: ["entries"]
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

function normalizeAmount(value: number | null | undefined, rawText: string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }

  const normalizedRawText = normalizeWhitespace(rawText);
  if (!normalizedRawText) {
    return null;
  }

  const matches = normalizedRawText.match(/\d[\d,]*/g);
  if (!matches || matches.length === 0) {
    return null;
  }

  const lastMatch = matches[matches.length - 1]?.replace(/,/g, "");
  const parsed = Number(lastMatch);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeTitle(row: OpenAiCreditRow, merchantName: string | null, index: number) {
  const title = normalizeWhitespace(row.title);

  if (title) {
    return title;
  }

  if (merchantName) {
    return `${merchantName} charge`;
  }

  return `statement ${index + 1}`;
}

function normalizeLine(row: OpenAiCreditRow, index: number): OcrExtractionLine {
  const merchantName = normalizeWhitespace(row.merchantName);
  const occurredOn = normalizeOccurredOn(row.occurredOn);
  const rawText = normalizeWhitespace(row.rawText);
  const amount = normalizeAmount(row.amount, rawText);
  const title = normalizeTitle(row, merchantName, index);

  return {
    lineIndex: index,
    title,
    amount,
    merchantName,
    occurredOn,
    rawText,
    rawPayload: {
      provider: "openai",
      extractionType: "credit_screenshot",
      normalized: {
        merchantName,
        occurredOn,
        amount,
        title
      }
    }
  };
}

function parseCreditResponse(outputText: string): OpenAiCreditResponse {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(outputText);
  } catch {
    throw new OcrProviderError("parse-failed", "OpenAI OCR returned invalid JSON.");
  }

  const parsed = creditResponseSchema.safeParse(parsedJson);

  if (!parsed.success) {
    throw new OcrProviderError("parse-failed", "OpenAI OCR returned an invalid response shape.");
  }

  return parsed.data;
}

export class OpenAiCreditOcrProvider implements OcrProvider {
  async extract(request: OcrRequest): Promise<OcrExtractionResult> {
    if (request.sourceType !== "credit_screenshot") {
      throw new OcrProviderError(
        "provider-unavailable",
        "The OpenAI credit OCR provider only supports credit_screenshot."
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
          model: getOpenAiCreditOcrModel(),
          input: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text:
                    "You extract Japanese credit card statement rows from screenshots. Return only visible statement entries. One statement row must become one expense candidate. Do not split a single statement row into multiple products."
                }
              ]
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text:
                    "Read these Japanese credit card statement screenshots and extract one entry per visible charge. Prioritize merchantName first. Normalize occurredOn to YYYY-MM-DD when possible. Return amount as a positive integer JPY value. title may reuse merchantName plus 'charge' when no clearer label exists. Keep only what is visibly supported by the screenshot. If a field is unclear, return null instead of guessing. rawText should preserve the visible row text as closely as possible."
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
              ...CREDIT_OCR_JSON_SCHEMA
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

      const parsed = parseCreditResponse(outputText);
      const lines = parsed.entries.map(normalizeLine).filter((line) => {
        return Boolean(line.merchantName || line.amount || line.occurredOn || line.rawText);
      });

      return {
        sourceType: "credit_screenshot",
        providerName: "openai-credit",
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
