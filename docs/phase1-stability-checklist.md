# Phase 1 Stability Checklist

## Supabase migrations

Apply these migrations in order:

1. `supabase/migrations/202603240001_phase1_init.sql`
2. `supabase/migrations/202603240002_phase1_hardening.sql`
3. `supabase/migrations/202603240003_manual_entry_constraints.sql`
4. `supabase/migrations/202603240004_review_confirmation.sql`
5. `supabase/migrations/202603240005_import_group_deletion.sql`

## Supabase confirmation points

- `categories`, `import_groups`, `expense_drafts`, `expenses`, `classification_rules` tables exist.
- `categories` contains the initial 14 rows.
- RLS is enabled on:
  - `categories`
  - `import_groups`
  - `expense_drafts`
  - `expenses`
  - `classification_rules`
- CRUD policies exist for `import_groups`, `expense_drafts`, `expenses`, `classification_rules`.
- `confirm_import_group(uuid)` exists and can be executed by `authenticated`.
- `delete_import_group(uuid)` exists and can be executed by `authenticated`.

## Example SQL checks

```sql
select tablename
from pg_tables
where schemaname = 'public'
order by tablename;
```

```sql
select policyname, tablename, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

```sql
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('confirm_import_group', 'delete_import_group');
```

```sql
select id, slug, name, sort_order, is_active
from public.categories
order by sort_order;
```

## App flow checklist

### 1. Manual entry

- Log in with the allowed email account.
- Open `/register/manual`.
- Enter date, title, amount, category, and optional merchant / memo.
- Save and confirm redirect to `/expenses?created=1`.
- Confirm the expense appears in the list.

### 2. Receipt upload

- Open `/register/receipt`.
- Select 1 to 3 images.
- Continue to review.
- Confirm draft rows are created.
- Edit at least one row.
- Confirm and check `/expenses`.

### 3. Credit screenshot upload

- Open `/register/credit`.
- Select 1 to 3 images.
- Continue to review.
- Confirm one statement row is handled as one expense row.
- Edit merchant / date / category if needed.
- Confirm and check `/expenses`.

### 4. Review validation

- In review, clear `title` and try to save.
- Set `amount` to `0` and try to save.
- Clear `occurred_on` and try to save.
- Confirm field-level errors appear on that row.
- Fix values and confirm the row saves.

### 5. Draft discard

- In review, choose discard for the current import group.
- Confirm redirect back to register.
- Confirm related draft rows are gone.

### 6. Confirmed import group deletion

- Open `/expenses`.
- Delete one confirmed import group from the list.
- Confirm all linked expenses disappear together.

### 7. Session continuity

- Log out.
- Log back in with the same allowed email.
- Confirm saved expenses remain visible.

### 8. Representative error cases

- Submit upload with no files.
- Submit upload with 4 files.
- Submit upload with a non-image file.
- Confirm each case returns to the source page with an error notice.
