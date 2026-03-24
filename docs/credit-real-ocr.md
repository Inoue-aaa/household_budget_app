# Real OCR Setup

## Overview

The current real OCR path supports both `credit_screenshot` and `receipt`.

- `OCR_PROVIDER_MODE=dummy`
  - receipt and credit both use the dummy provider
- `OCR_PROVIDER_MODE=real`
  - receipt uses the OpenAI receipt provider
  - credit uses the OpenAI credit provider

Review remains the final correction step for both flows.

## Required env

```env
OCR_PROVIDER_MODE=dummy
OPENAI_API_KEY=
OPENAI_CREDIT_OCR_MODEL=gpt-4.1-mini
OPENAI_RECEIPT_OCR_MODEL=gpt-4.1-mini
OPENAI_OCR_TIMEOUT_MS=20000
```

## Missing env behavior

- If `OCR_PROVIDER_MODE=real` and `OPENAI_API_KEY` is missing:
  - receipt upload does not proceed to review
  - credit upload does not proceed to review
  - the user is returned to the source upload screen
  - a notice explains that the OCR API key is not configured

## Notes

- Images are sent directly from the server action to the OCR provider and are not stored long term.
- The OpenAI response is reduced to the minimum row fields needed for review.
- receipt and credit keep separate provider implementations so their prompts and normalization can evolve independently.

## Receipt verification points

- `merchant_name` should be filled when the store name is visible.
- `occurred_on` should be normalized to `YYYY-MM-DD` when the receipt shows a clear date.
- `amount` should be stored as an integer JPY value when a visible amount is found.
- If itemized rows are weak, a summary row such as `レシート合計` is acceptable.
- If only part of the receipt is readable, the extracted rows should still reach review and remain easy to correct.

## Credit verification points

- One visible statement row should become one draft row.
- `merchant_name` should be the most recognizable usage destination first.
- `occurred_on` should be normalized to `YYYY-MM-DD` when the screenshot clearly shows a date.
- `amount` should be stored as an integer JPY value.
- `title` may reuse the merchant name plus `利用分` when the source row has no better label.
- If merchant, date, or amount is weak, the row should still reach review and remain easy to correct.

## Failure handling

- Invalid JSON shape from OpenAI is treated as `parse-failed`.
- Valid JSON with zero usable entries is treated as `empty`.
- Missing API key is treated as `api-key-missing`.
- Timeout is treated as `timeout`.
