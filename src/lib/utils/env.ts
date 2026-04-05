export function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://household-budget-app-mauve.vercel.app"
  );
  //return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function getAllowedUserEmail() {
  return process.env.ALLOWED_USER_EMAIL?.trim().toLowerCase() ?? "";
}

export function getOcrProviderMode() {
  const value = process.env.OCR_PROVIDER_MODE?.trim().toLowerCase();

  if (value === "real" || value === "ollama_local") {
    return value;
  }

  return "dummy";
}

export function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY?.trim() ?? "";
}

export function getOpenAiCreditOcrModel() {
  return process.env.OPENAI_CREDIT_OCR_MODEL?.trim() || "gpt-4.1-mini";
}

export function getOpenAiReceiptOcrModel() {
  return process.env.OPENAI_RECEIPT_OCR_MODEL?.trim() || "gpt-4.1-mini";
}

export function getOllamaBaseUrl() {
  return process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434";
}

export function getOllamaOcrModel() {
  return process.env.OLLAMA_OCR_MODEL?.trim() || "gemma3:12b";
}

export function getOllamaOcrTimeoutMs() {
  const value = Number(process.env.OLLAMA_OCR_TIMEOUT_MS ?? "30000");
  return Number.isFinite(value) && value > 0 ? value : 30_000;
}

export function getOpenAiOcrTimeoutMs() {
  const value = Number(process.env.OPENAI_OCR_TIMEOUT_MS ?? "120000");
  return Number.isFinite(value) && value > 0 ? value : 120_000;
}
