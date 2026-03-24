import { z } from "zod";
import type { OcrProvider, OcrRequest } from "@/lib/ocr/provider";
import { OcrProviderError } from "@/lib/ocr/types";
import type { OcrExtractionLine, OcrExtractionResult } from "@/lib/ocr/types";
import {
  normalizeAmount,
  normalizeOccurredOn,
  normalizeWhitespace,
  requestOllamaJson
} from "@/lib/ocr/ollama-shared";

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

type OllamaCreditRow = z.infer<typeof creditRowSchema>;

const CREDIT_OCR_JSON_SCHEMA = {
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
} as const;

function normalizeTitle(row: OllamaCreditRow, merchantName: string | null, index: number) {
  const title = normalizeWhitespace(row.title);

  if (title) {
    return title;
  }

  if (merchantName) {
    return `${merchantName} charge`;
  }

  return `statement ${index + 1}`;
}

function normalizeLine(row: OllamaCreditRow, index: number): OcrExtractionLine {
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
      provider: "ollama",
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

export class OllamaCreditOcrProvider implements OcrProvider {
  async extract(request: OcrRequest): Promise<OcrExtractionResult> {
    if (request.sourceType !== "credit_screenshot") {
      throw new OcrProviderError(
        "provider-unavailable",
        "The Ollama credit OCR provider only supports credit_screenshot."
      );
    }

    const payload = await requestOllamaJson({
      schema: CREDIT_OCR_JSON_SCHEMA,
      systemPrompt:
        "You extract Japanese credit card statement rows from screenshots. Return only visible statement entries. One statement row must become one expense candidate. Do not split a single statement row into multiple products.",
      userPrompt:
        "Read these Japanese credit card statement screenshots and extract one entry per visible charge. Prioritize merchantName first. Normalize occurredOn to YYYY-MM-DD when possible. Return amount as a positive integer JPY value. title may reuse merchantName plus 'charge' when no clearer label exists. If a field is unclear, return null instead of guessing. Return only JSON that matches the requested schema.",
      images: request.files.map((file) => file.bytes)
    });

    const parsed = creditResponseSchema.safeParse(payload);

    if (!parsed.success) {
      throw new OcrProviderError("parse-failed", "Ollama returned an invalid response shape.");
    }

    const lines = parsed.data.entries.map(normalizeLine).filter((line) => {
      return Boolean(line.merchantName || line.amount || line.occurredOn || line.rawText);
    });

    return {
      sourceType: "credit_screenshot",
      providerName: "ollama-credit",
      providerMode: "ollama_local",
      fallbackUsed: false,
      lines
    };
  }
}
