# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start development server (port 3000)
npm run build      # Production build
npm run lint       # ESLint + Next.js linting
npm run test:e2e   # Playwright end-to-end tests
```

E2E tests require `.auth/user.json` (authenticated storage state). See `docs/phase1-e2e.md` for setup.

## Architecture

**Next.js 15 App Router + Supabase** household budget tracker (mobile-first, Japanese UI).

### Route Groups

- `src/app/(app)/` — Protected routes (requires auth). Includes home, expenses, register, settings.
- `src/app/(auth)/` — Public routes (`/login`, `/signup`).
- `src/app/api/` — API routes (e.g., `app-shell-snapshot`).

### Source Layout

- `src/features/` — Feature modules by domain (auth, expenses, receipt-upload, credit-upload, monthly-budget, account-switcher, etc.)
- `src/lib/` — Core utilities: Supabase clients, finance queries, OCR, classification, preferences
- `src/components/` — Shared UI components
- `src/middleware.ts` — Supabase session management for all requests

### Data Flow

1. **Auth**: Email/password via Supabase Auth. Session managed in cookies via middleware.
2. **Accounts**: Each user has 3 household accounts (atsuki, sara, shared). Active account stored in `user_preferences`.
3. **Expense Import**: Receipt/credit card image → OCR → `expense_drafts` → review → `confirm_import_group()` → `expenses`
4. **Manual Entry**: Direct insert into `expenses` via Server Action.

### Database

Direct SQL queries via Supabase client (no ORM). RLS enabled on all tables.

Key tables: `expenses`, `expense_drafts`, `import_groups`, `categories`, `household_accounts`, `monthly_budgets`, `classification_rules`, `user_preferences`.

Key PL/pgSQL functions:
- `confirm_import_group(uuid)` — Batch-converts drafts to confirmed expenses
- `upsert_monthly_budget()` — Create/update monthly budget
- `get_default_household_account_id()` — Returns default account for user

Schema migrations in `supabase/migrations/`.

### OCR System

Pluggable via `OCR_PROVIDER_MODE` env var:
- `dummy` — Mock (for dev/testing)
- `real` — OpenAI GPT-4 vision (`OPENAI_API_KEY` required)
- `ollama_local` — Local Ollama (`OLLAMA_BASE_URL`, `OLLAMA_OCR_MODEL` required)

Factory pattern in `src/lib/ocr/factory.ts`. Supports receipt and credit card statement parsing.

### Classification

`src/lib/classification/` — Suggests expense categories based on merchant names using learned rules stored in `classification_rules` table.

## Environment Variables

See `.env.example`. Required:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `ALLOWED_USER_EMAIL` — Single authorized email (early-access gate)
- `OCR_PROVIDER_MODE`

## Path Aliases

`@/*` maps to `src/*`.
