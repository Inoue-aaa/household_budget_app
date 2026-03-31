create table if not exists public.budget_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.household_accounts (id) on delete cascade,
  name text,
  total_budget integer not null default 0 check (total_budget >= 0),
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.budget_template_categories (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.budget_templates (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  budget_amount integer not null default 0 check (budget_amount >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint budget_template_categories_unique unique (template_id, category_id)
);

alter table public.monthly_budgets
  add column if not exists template_id uuid references public.budget_templates (id) on delete set null;

alter table public.monthly_budget_categories
  add column if not exists budget_amount integer not null default 0 check (budget_amount >= 0);

alter table public.monthly_budget_categories
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create index if not exists budget_templates_user_account_idx
  on public.budget_templates (user_id, account_id, created_at desc);

create index if not exists budget_template_categories_template_idx
  on public.budget_template_categories (template_id);

create index if not exists budget_template_categories_category_idx
  on public.budget_template_categories (category_id);

create unique index if not exists budget_templates_default_per_account_idx
  on public.budget_templates (user_id, account_id)
  where is_default = true;

drop trigger if exists set_budget_templates_updated_at on public.budget_templates;
create trigger set_budget_templates_updated_at
before update on public.budget_templates
for each row
execute function public.set_updated_at();

drop trigger if exists set_budget_template_categories_updated_at on public.budget_template_categories;
create trigger set_budget_template_categories_updated_at
before update on public.budget_template_categories
for each row
execute function public.set_updated_at();

drop trigger if exists set_monthly_budget_categories_updated_at on public.monthly_budget_categories;
create trigger set_monthly_budget_categories_updated_at
before update on public.monthly_budget_categories
for each row
execute function public.set_updated_at();

alter table public.budget_templates enable row level security;
alter table public.budget_template_categories enable row level security;

drop policy if exists "Users can select own budget templates" on public.budget_templates;
create policy "Users can select own budget templates"
on public.budget_templates
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own budget templates" on public.budget_templates;
create policy "Users can insert own budget templates"
on public.budget_templates
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own budget templates" on public.budget_templates;
create policy "Users can update own budget templates"
on public.budget_templates
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own budget templates" on public.budget_templates;
create policy "Users can delete own budget templates"
on public.budget_templates
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can select own budget template categories" on public.budget_template_categories;
create policy "Users can select own budget template categories"
on public.budget_template_categories
for select
to authenticated
using (
  exists (
    select 1
    from public.budget_templates
    where budget_templates.id = budget_template_categories.template_id
      and budget_templates.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own budget template categories" on public.budget_template_categories;
create policy "Users can insert own budget template categories"
on public.budget_template_categories
for insert
to authenticated
with check (
  exists (
    select 1
    from public.budget_templates
    where budget_templates.id = budget_template_categories.template_id
      and budget_templates.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own budget template categories" on public.budget_template_categories;
create policy "Users can update own budget template categories"
on public.budget_template_categories
for update
to authenticated
using (
  exists (
    select 1
    from public.budget_templates
    where budget_templates.id = budget_template_categories.template_id
      and budget_templates.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.budget_templates
    where budget_templates.id = budget_template_categories.template_id
      and budget_templates.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own budget template categories" on public.budget_template_categories;
create policy "Users can delete own budget template categories"
on public.budget_template_categories
for delete
to authenticated
using (
  exists (
    select 1
    from public.budget_templates
    where budget_templates.id = budget_template_categories.template_id
      and budget_templates.user_id = auth.uid()
  )
);

insert into public.budget_templates (
  user_id,
  account_id,
  name,
  total_budget,
  is_default
)
select latest.user_id,
       latest.account_id,
       'デフォルト予算',
       latest.budget_amount,
       true
from (
  select distinct on (mb.user_id, mb.account_id)
    mb.user_id,
    mb.account_id,
    mb.budget_amount
  from public.monthly_budgets mb
  order by mb.user_id, mb.account_id, mb.target_month desc
) latest
where not exists (
  select 1
  from public.budget_templates bt
  where bt.user_id = latest.user_id
    and bt.account_id = latest.account_id
    and bt.is_default = true
);

update public.monthly_budgets mb
set template_id = bt.id
from public.budget_templates bt
where mb.template_id is null
  and bt.user_id = mb.user_id
  and bt.account_id = mb.account_id
  and bt.is_default = true;

with latest_monthly_budget as (
  select distinct on (mb.user_id, mb.account_id)
    mb.id as monthly_budget_id,
    mb.user_id,
    mb.account_id
  from public.monthly_budgets mb
  order by mb.user_id, mb.account_id, mb.target_month desc
)
insert into public.budget_template_categories (
  template_id,
  category_id,
  budget_amount
)
select bt.id,
       mbc.category_id,
       mbc.budget_amount
from latest_monthly_budget latest
join public.budget_templates bt
  on bt.user_id = latest.user_id
 and bt.account_id = latest.account_id
 and bt.is_default = true
join public.monthly_budget_categories mbc
  on mbc.monthly_budget_id = latest.monthly_budget_id
where not exists (
  select 1
  from public.budget_template_categories btc
  where btc.template_id = bt.id
    and btc.category_id = mbc.category_id
);
