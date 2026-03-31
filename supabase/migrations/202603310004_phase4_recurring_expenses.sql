create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.household_accounts (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null check (char_length(name) <= 120),
  amount integer not null check (amount > 0),
  schedule_day integer not null check (schedule_day between 1 and 31),
  schedule_time time not null default '09:00',
  memo text null check (memo is null or char_length(memo) <= 300),
  is_active boolean not null default true,
  start_date date null,
  end_date date null,
  last_applied_at timestamptz null,
  next_scheduled_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists recurring_expenses_user_account_idx
  on public.recurring_expenses (user_id, account_id, is_active, schedule_day);

create index if not exists recurring_expenses_account_category_idx
  on public.recurring_expenses (account_id, category_id);

drop trigger if exists set_recurring_expenses_updated_at on public.recurring_expenses;
create trigger set_recurring_expenses_updated_at
before update on public.recurring_expenses
for each row
execute function public.set_updated_at();

alter table public.recurring_expenses enable row level security;

drop policy if exists "Users can select own recurring expenses" on public.recurring_expenses;
create policy "Users can select own recurring expenses"
on public.recurring_expenses
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own recurring expenses" on public.recurring_expenses;
create policy "Users can insert own recurring expenses"
on public.recurring_expenses
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.household_accounts
    where household_accounts.id = recurring_expenses.account_id
      and household_accounts.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own recurring expenses" on public.recurring_expenses;
create policy "Users can update own recurring expenses"
on public.recurring_expenses
for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.household_accounts
    where household_accounts.id = recurring_expenses.account_id
      and household_accounts.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own recurring expenses" on public.recurring_expenses;
create policy "Users can delete own recurring expenses"
on public.recurring_expenses
for delete
to authenticated
using (auth.uid() = user_id);
