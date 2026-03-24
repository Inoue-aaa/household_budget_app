# Phase 1 E2E

## Purpose

This test set covers the minimum phase 1 flows without adding new product behavior.

- Manual entry save
- Receipt upload to review to confirm
- Credit screenshot upload to review to confirm
- Draft import group discard
- Confirmed import group delete

## Preconditions

1. Install dependencies.

```bash
npm install
```

2. Apply Supabase migrations `001` through `005`.
3. Start the app locally.

```bash
npm run dev
```

4. Prepare an authenticated Playwright storage state for the allowed account.

Example:

- Log in manually in a temporary Playwright session or browser automation script.
- Save the authenticated cookies/session to a file such as `.auth/user.json`.

## Environment variables

- `PLAYWRIGHT_BASE_URL`
  - Optional.
  - Default: `http://127.0.0.1:3000`
- `PLAYWRIGHT_AUTH_FILE`
  - Required for these tests.
  - Example: `.auth/user.json`

## Run

```bash
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3000'
$env:PLAYWRIGHT_AUTH_FILE='.auth/user.json'
npm run test:e2e
```

## Scope

Automated:

- Main phase 1 save flow
- Review confirm flow
- Draft discard flow
- Confirmed import group delete flow

Still manual:

- Magic Link delivery itself
- Real OCR provider behavior
- Supabase dashboard confirmation
- Visual fine-tuning across devices

## Notes

- The tests are designed for the current dummy OCR behavior.
- If no authenticated storage state is provided, the suite is skipped instead of failing.
- TODO: add a small helper to generate storage state more easily once the preferred local auth workflow is fixed.
