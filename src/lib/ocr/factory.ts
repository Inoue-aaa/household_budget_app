import { OllamaCreditOcrProvider } from "@/lib/ocr/ollama-credit-provider";
import { OllamaReceiptOcrProvider } from "@/lib/ocr/ollama-receipt-provider";
import { OpenAiCreditOcrProvider } from "@/lib/ocr/openai-credit-provider";
import { OpenAiReceiptOcrProvider } from "@/lib/ocr/openai-receipt-provider";
import { DummyOcrProvider, type OcrProvider, type OcrRequest } from "@/lib/ocr/provider";
import { getOcrProviderMode } from "@/lib/utils/env";

export type OcrProviderMode = "dummy" | "real" | "ollama_local";

class HybridOcrProvider implements OcrProvider {
  constructor(
    private readonly receiptProvider: OcrProvider,
    private readonly creditProvider: OcrProvider
  ) {}

  async extract(request: OcrRequest) {
    if (request.sourceType === "credit_screenshot") {
      return this.creditProvider.extract(request);
    }

    return this.receiptProvider.extract(request);
  }
}

export function createOcrProvider(): OcrProvider {
  const mode = getOcrProviderMode();

  switch (mode) {
    case "real":
      return new HybridOcrProvider(
        new OpenAiReceiptOcrProvider(),
        new OpenAiCreditOcrProvider()
      );
    case "ollama_local":
      return new HybridOcrProvider(
        new OllamaReceiptOcrProvider(),
        new OllamaCreditOcrProvider()
      );
    case "dummy":
    default:
      return new DummyOcrProvider();
  }
}
