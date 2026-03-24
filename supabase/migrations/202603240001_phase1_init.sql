create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.import_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_type text not null check (source_type in ('receipt', 'manual', 'credit_screenshot')),
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'discarded')),
  title text,
  occurred_on date,
  metadata jsonb not null default '{}'::jsonb,
  confirmed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.expense_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  import_group_id uuid not null references public.import_groups (id) on delete cascade,
  line_index integer not null default 0,
  occurred_on date,
  merchant_name text,
  title text not null,
  amount integer,
  suggested_category_id uuid references public.categories (id),
  note text,
  source_type text not null check (source_type in ('receipt', 'manual', 'credit_screenshot')),
  needs_review boolean not null default true,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  import_group_id uuid not null references public.import_groups (id) on delete cascade,
  occurred_on date not null,
  merchant_name text,
  title text not null,
  amount integer not null check (amount > 0),
  suggested_category_id uuid references public.categories (id),
  category_id uuid not null references public.categories (id),
  note text,
  source_type text not null check (source_type in ('receipt', 'manual', 'credit_screenshot')),
  is_category_corrected boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.classification_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  normalized_item_name text not null,
  normalized_merchant_name text not null default '',
  category_id uuid not null references public.categories (id),
  rule_source text not null default 'user_confirmation' check (rule_source in ('manual_entry', 'user_confirmation', 'admin_seed')),
  usage_count integer not null default 1,
  last_used_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint classification_rules_unique unique (user_id, normalized_item_name, normalized_merchant_name)
);

create index if not exists import_groups_user_id_created_at_idx
  on public.import_groups (user_id, created_at desc);

create index if not exists expense_drafts_user_id_import_group_id_idx
  on public.expense_drafts (user_id, import_group_id);

create index if not exists expenses_user_id_occurred_on_idx
  on public.expenses (user_id, occurred_on desc);

create index if not exists expenses_import_group_id_idx
  on public.expenses (import_group_id);

create index if not exists classification_rules_user_id_item_idx
  on public.classification_rules (user_id, normalized_item_name, normalized_merchant_name);

drop trigger if exists set_import_groups_updated_at on public.import_groups;
create trigger set_import_groups_updated_at
before update on public.import_groups
for each row
execute function public.set_updated_at();

drop trigger if exists set_expense_drafts_updated_at on public.expense_drafts;
create trigger set_expense_drafts_updated_at
before update on public.expense_drafts
for each row
execute function public.set_updated_at();

drop trigger if exists set_expenses_updated_at on public.expenses;
create trigger set_expenses_updated_at
before update on public.expenses
for each row
execute function public.set_updated_at();

drop trigger if exists set_classification_rules_updated_at on public.classification_rules;
create trigger set_classification_rules_updated_at
before update on public.classification_rules
for each row
execute function public.set_updated_at();

alter table public.categories enable row level security;
alter table public.import_groups enable row level security;
alter table public.expense_drafts enable row level security;
alter table public.expenses enable row level security;
alter table public.classification_rules enable row level security;

drop policy if exists "Authenticated users can read categories" on public.categories;
create policy "Authenticated users can read categories"
on public.categories
for select
to authenticated
using (true);

drop policy if exists "Users can manage own import groups" on public.import_groups;
create policy "Users can manage own import groups"
on public.import_groups
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own expense drafts" on public.expense_drafts;
create policy "Users can manage own expense drafts"
on public.expense_drafts
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own expenses" on public.expenses;
create policy "Users can manage own expenses"
on public.expenses
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can manage own classification rules" on public.classification_rules;
create policy "Users can manage own classification rules"
on public.classification_rules
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into public.categories (id, slug, name, sort_order)
values
  ('00000000-0000-0000-0000-000000000001', 'food', '食費', 1),
  ('00000000-0000-0000-0000-000000000002', 'daily-necessities', '日用品', 2),
  ('00000000-0000-0000-0000-000000000003', 'luxury', '嗜好品', 3),
  ('00000000-0000-0000-0000-000000000004', 'social', '交際費', 4),
  ('00000000-0000-0000-0000-000000000005', 'transportation', '交通費', 5),
  ('00000000-0000-0000-0000-000000000006', 'health', '医療・健康', 6),
  ('00000000-0000-0000-0000-000000000007', 'entertainment', '趣味・娯楽', 7),
  ('00000000-0000-0000-0000-000000000008', 'fashion-beauty', '被服・美容', 8),
  ('00000000-0000-0000-0000-000000000009', 'communication', '通信', 9),
  ('00000000-0000-0000-0000-000000000010', 'utilities', '水道・光熱費', 10),
  ('00000000-0000-0000-0000-000000000011', 'housing', '住居', 11),
  ('00000000-0000-0000-0000-000000000012', 'education', '教育・自己投資', 12),
  ('00000000-0000-0000-0000-000000000013', 'special', '特別支出', 13),
  ('00000000-0000-0000-0000-000000000014', 'other', 'その他', 14)
on conflict (id) do update
set
  slug = excluded.slug,
  name = excluded.name,
  sort_order = excluded.sort_order;
