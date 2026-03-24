import { z } from "zod";
import { getOllamaBaseUrl, getOllamaOcrModel, getOllamaOcrTimeoutMs } from "@/lib/utils/env";
import { OcrProviderError } from "@/lib/ocr/types";

type OllamaChatMessage = {
  role: "system" | "user";
  content: string;
  images?: string[];
};

type OllamaChatRequest = {
  model: string;
  stream: false;
  format: Record<string, unknown>;
  options?: {
    temperature?: number;
  };
  messages: OllamaChatMessage[];
};

const ollamaChatResponseSchema = z.object({
  message: z.object({
    content: z.string()
  })
});

export function bytesToBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

export function normalizeWhitespace(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() || null;
}

export function normalizeOccurredOn(value: string | null | undefined) {
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

export function normalizeAmount(value: number | null | undefined, rawText: string | null | undefined) {
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

export async function requestOllamaJson(input: {
  schema: Record<string, unknown>;
  systemPrompt: string;
  userPrompt: string;
  images: Uint8Array[];
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getOllamaOcrTimeoutMs());

  const payload: OllamaChatRequest = {
    model: getOllamaOcrModel(),
    stream: false,
    format: input.schema,
    options: {
      temperature: 0
    },
    messages: [
      {
        role: "system",
        content: input.systemPrompt
      },
      {
        role: "user",
        content: input.userPrompt,
        images: input.images.map(bytesToBase64)
      }
    ]
  };

  try {
    const response = await fetch(`${getOllamaBaseUrl().replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new OcrProviderError(
        "request-failed",
        `Ollama OCR request failed with status ${response.status}.`
      );
    }

    const json = await response.json();
    const parsedEnvelope = ollamaChatResponseSchema.safeParse(json);

    if (!parsedEnvelope.success) {
      throw new OcrProviderError("parse-failed", "Ollama returned an invalid response envelope.");
    }

    try {
      return JSON.parse(parsedEnvelope.data.message.content) as unknown;
    } catch {
      throw new OcrProviderError("parse-failed", "Ollama returned invalid JSON content.");
    }
  } catch (error) {
    if (error instanceof OcrProviderError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new OcrProviderError("timeout", "Ollama OCR request timed out.");
    }

    throw new OcrProviderError("request-failed", "Ollama OCR request failed.");
  } finally {
    clearTimeout(timeout);
  }
}
