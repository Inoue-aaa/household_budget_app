create table if not exists public.recurring_expense_candidate_hides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.household_accounts (id) on delete cascade,
  recurring_expense_id uuid not null references public.recurring_expenses (id) on delete cascade,
  target_month date not null,
  created_at timestamptz not null default now()
);

create unique index if not exists recurring_expense_candidate_hides_unique_idx
  on public.recurring_expense_candidate_hides (account_id, recurring_expense_id, target_month);

create index if not exists recurring_expense_candidate_hides_account_idx
  on public.recurring_expense_candidate_hides (account_id, created_at desc);

alter table public.recurring_expense_candidate_hides enable row level security;

drop policy if exists "Users can read their recurring expense candidate hides" on public.recurring_expense_candidate_hides;
create policy "Users can read their recurring expense candidate hides"
  on public.recurring_expense_candidate_hides
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their recurring expense candidate hides" on public.recurring_expense_candidate_hides;
create policy "Users can insert their recurring expense candidate hides"
  on public.recurring_expense_candidate_hides
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their recurring expense candidate hides" on public.recurring_expense_candidate_hides;
create policy "Users can delete their recurring expense candidate hides"
  on public.recurring_expense_candidate_hides
  for delete
  using (auth.uid() = user_id);
