alter table public.import_groups
  add column if not exists recurring_expense_id uuid null references public.recurring_expenses (id) on delete set null;

alter table public.expenses
  add column if not exists recurring_expense_id uuid null references public.recurring_expenses (id) on delete set null;

create index if not exists import_groups_recurring_expense_id_idx
  on public.import_groups (recurring_expense_id);

create index if not exists expenses_recurring_expense_id_idx
  on public.expenses (recurring_expense_id);

create table if not exists public.recurring_expense_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.household_accounts (id) on delete cascade,
  recurring_expense_id uuid not null references public.recurring_expenses (id) on delete cascade,
  applied_import_group_id uuid null references public.import_groups (id) on delete set null,
  applied_expense_id uuid null references public.expenses (id) on delete set null,
  executed_at timestamptz not null default timezone('utc', now()),
  target_month date not null,
  result_type text not null check (
    result_type in ('applied', 'skipped', 'inactive', 'already_applied', 'out_of_range')
  ),
  amount integer null,
  reason text null check (reason is null or char_length(reason) <= 300),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists recurring_expense_logs_account_created_idx
  on public.recurring_expense_logs (account_id, created_at desc);

create index if not exists recurring_expense_logs_recurring_target_idx
  on public.recurring_expense_logs (recurring_expense_id, target_month desc);

create unique index if not exists recurring_expense_logs_unique_month_result_idx
  on public.recurring_expense_logs (recurring_expense_id, target_month, result_type);

alter table public.recurring_expense_logs enable row level security;

drop policy if exists "Users can select own recurring expense logs" on public.recurring_expense_logs;
create policy "Users can select own recurring expense logs"
on public.recurring_expense_logs
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own recurring expense logs" on public.recurring_expense_logs;
create policy "Users can insert own recurring expense logs"
on public.recurring_expense_logs
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.household_accounts
    where household_accounts.id = recurring_expense_logs.account_id
      and household_accounts.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own recurring expense logs" on public.recurring_expense_logs;
create policy "Users can update own recurring expense logs"
on public.recurring_expense_logs
for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.household_accounts
    where household_accounts.id = recurring_expense_logs.account_id
      and household_accounts.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own recurring expense logs" on public.recurring_expense_logs;
create policy "Users can delete own recurring expense logs"
on public.recurring_expense_logs
for delete
to authenticated
using (auth.uid() = user_id);
