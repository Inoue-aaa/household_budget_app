create table if not exists public.consultation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.household_accounts (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  latest_template_key text null check (
    latest_template_key is null
    or latest_template_key in (
      'high_spend_categories',
      'saving_points',
      'increased_spending',
      'over_budget',
      'fixed_variable_balance',
      'spending_summary'
    )
  ),
  title text null check (title is null or char_length(title) <= 160),
  last_question text null check (last_question is null or char_length(last_question) <= 1000),
  last_answer_summary text null check (last_answer_summary is null or char_length(last_answer_summary) <= 500),
  last_consulted_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.consultation_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.consultation_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.household_accounts (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 8000),
  template_key text null check (
    template_key is null
    or template_key in (
      'high_spend_categories',
      'saving_points',
      'increased_spending',
      'over_budget',
      'fixed_variable_balance',
      'spending_summary'
    )
  ),
  answer_summary text null check (answer_summary is null or char_length(answer_summary) <= 500),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.saved_consultation_cards (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.consultation_sessions (id) on delete cascade,
  message_id uuid not null references public.consultation_messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.household_accounts (id) on delete cascade,
  title text null check (title is null or char_length(title) <= 160),
  answer_summary text null check (answer_summary is null or char_length(answer_summary) <= 500),
  related_category_id uuid null references public.categories (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint saved_consultation_cards_message_unique unique (message_id)
);

create index if not exists consultation_sessions_user_account_idx
  on public.consultation_sessions (user_id, account_id, last_consulted_at desc);

create index if not exists consultation_messages_session_created_idx
  on public.consultation_messages (session_id, created_at asc);

create index if not exists consultation_messages_user_account_idx
  on public.consultation_messages (user_id, account_id, created_at desc);

create index if not exists saved_consultation_cards_user_account_idx
  on public.saved_consultation_cards (user_id, account_id, created_at desc);

drop trigger if exists set_consultation_sessions_updated_at on public.consultation_sessions;
create trigger set_consultation_sessions_updated_at
before update on public.consultation_sessions
for each row
execute function public.set_updated_at();

alter table public.consultation_sessions enable row level security;
alter table public.consultation_messages enable row level security;
alter table public.saved_consultation_cards enable row level security;

drop policy if exists "Users can select own consultation sessions" on public.consultation_sessions;
create policy "Users can select own consultation sessions"
on public.consultation_sessions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own consultation sessions" on public.consultation_sessions;
create policy "Users can insert own consultation sessions"
on public.consultation_sessions
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.household_accounts
    where household_accounts.id = consultation_sessions.account_id
      and household_accounts.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own consultation sessions" on public.consultation_sessions;
create policy "Users can update own consultation sessions"
on public.consultation_sessions
for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.household_accounts
    where household_accounts.id = consultation_sessions.account_id
      and household_accounts.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own consultation sessions" on public.consultation_sessions;
create policy "Users can delete own consultation sessions"
on public.consultation_sessions
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can select own consultation messages" on public.consultation_messages;
create policy "Users can select own consultation messages"
on public.consultation_messages
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own consultation messages" on public.consultation_messages;
create policy "Users can insert own consultation messages"
on public.consultation_messages
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.consultation_sessions
    where consultation_sessions.id = consultation_messages.session_id
      and consultation_sessions.user_id = auth.uid()
      and consultation_sessions.account_id = consultation_messages.account_id
  )
);

drop policy if exists "Users can update own consultation messages" on public.consultation_messages;
create policy "Users can update own consultation messages"
on public.consultation_messages
for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.consultation_sessions
    where consultation_sessions.id = consultation_messages.session_id
      and consultation_sessions.user_id = auth.uid()
      and consultation_sessions.account_id = consultation_messages.account_id
  )
);

drop policy if exists "Users can delete own consultation messages" on public.consultation_messages;
create policy "Users can delete own consultation messages"
on public.consultation_messages
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can select own saved consultation cards" on public.saved_consultation_cards;
create policy "Users can select own saved consultation cards"
on public.saved_consultation_cards
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own saved consultation cards" on public.saved_consultation_cards;
create policy "Users can insert own saved consultation cards"
on public.saved_consultation_cards
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.consultation_messages
    where consultation_messages.id = saved_consultation_cards.message_id
      and consultation_messages.user_id = auth.uid()
      and consultation_messages.account_id = saved_consultation_cards.account_id
  )
);

drop policy if exists "Users can update own saved consultation cards" on public.saved_consultation_cards;
create policy "Users can update own saved consultation cards"
on public.saved_consultation_cards
for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.consultation_messages
    where consultation_messages.id = saved_consultation_cards.message_id
      and consultation_messages.user_id = auth.uid()
      and consultation_messages.account_id = saved_consultation_cards.account_id
  )
);

drop policy if exists "Users can delete own saved consultation cards" on public.saved_consultation_cards;
create policy "Users can delete own saved consultation cards"
on public.saved_consultation_cards
for delete
to authenticated
using (auth.uid() = user_id);
