# Ollama Local OCR

## Overview

This app can use a local Ollama OCR mode in addition to `dummy` and `real`.

- `dummy`
  - receipt and credit both use the dummy provider
- `real`
  - receipt and credit use the OpenAI-backed providers
- `ollama_local`
  - credit uses the Ollama credit provider
  - receipt uses the Ollama receipt provider

The current priority is `credit_screenshot`. Receipt is supported with a minimum extraction path and still assumes review-based correction.

## Required env

```env
OCR_PROVIDER_MODE=ollama_local
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_OCR_MODEL=gemma3:12b
OLLAMA_OCR_TIMEOUT_MS=30000
```

## Local setup

1. Start Ollama

```powershell
ollama serve
```

2. Pull Gemma 3 12B

```powershell
ollama pull gemma3:12b
```

3. Set `.env.local`

```env
OCR_PROVIDER_MODE=ollama_local
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_OCR_MODEL=gemma3:12b
OLLAMA_OCR_TIMEOUT_MS=30000
```

4. Restart the Next.js dev server

## Behavior

- Images are converted to base64 on the server and sent directly to Ollama.
- The raw OCR response is not stored as-is.
- Only the minimum review fields are kept:
  - `merchantName`
  - `occurredOn`
  - `amount`
  - `title`
  - `rawText`

## Failure handling

- Invalid JSON shape is treated as `parse-failed`
- Valid JSON with zero usable entries becomes `empty`
- Request failure becomes `request-failed`
- Timeout becomes `timeout`
- Review does not open on failure; the user is returned to the upload page with a notice

## Verification

### credit_screenshot

- Upload a screenshot at `/register/credit`
- Confirm review opens with `provider: ollama-credit`
- Confirm `merchant_name / occurred_on / amount / title` are filled when visible

### receipt

- Upload a receipt image at `/register/receipt`
- Confirm review opens with `provider: ollama-receipt`
- It is acceptable if only a summary row or a few weak item candidates are produced
- Review is still the final correction step

## Notes

- Gemma 3 output can vary more than the OpenAI path, so `needs_review` is expected to remain common.
- TODO: improve receipt-specific prompting and row splitting once more real-image samples are collected.
