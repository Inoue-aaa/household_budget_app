create table if not exists public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target_month date not null,
  budget_amount integer not null default 0 check (budget_amount >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint monthly_budgets_unique_user_month unique (user_id, target_month),
  constraint monthly_budgets_month_start_check
    check (target_month = date_trunc('month', target_month::timestamp)::date)
);

create table if not exists public.monthly_budget_categories (
  id uuid primary key default gen_random_uuid(),
  monthly_budget_id uuid not null references public.monthly_budgets (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint monthly_budget_categories_unique unique (monthly_budget_id, category_id)
);

create index if not exists monthly_budgets_user_id_target_month_idx
  on public.monthly_budgets (user_id, target_month desc);

create index if not exists monthly_budget_categories_monthly_budget_id_idx
  on public.monthly_budget_categories (monthly_budget_id);

create index if not exists monthly_budget_categories_category_id_idx
  on public.monthly_budget_categories (category_id);

drop trigger if exists set_monthly_budgets_updated_at on public.monthly_budgets;
create trigger set_monthly_budgets_updated_at
before update on public.monthly_budgets
for each row
execute function public.set_updated_at();

alter table public.monthly_budgets enable row level security;
alter table public.monthly_budget_categories enable row level security;

drop policy if exists "Users can select own monthly budgets" on public.monthly_budgets;
create policy "Users can select own monthly budgets"
on public.monthly_budgets
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own monthly budgets" on public.monthly_budgets;
create policy "Users can insert own monthly budgets"
on public.monthly_budgets
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own monthly budgets" on public.monthly_budgets;
create policy "Users can update own monthly budgets"
on public.monthly_budgets
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own monthly budgets" on public.monthly_budgets;
create policy "Users can delete own monthly budgets"
on public.monthly_budgets
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can select own monthly budget categories" on public.monthly_budget_categories;
create policy "Users can select own monthly budget categories"
on public.monthly_budget_categories
for select
to authenticated
using (
  exists (
    select 1
    from public.monthly_budgets
    where monthly_budgets.id = monthly_budget_categories.monthly_budget_id
      and monthly_budgets.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own monthly budget categories" on public.monthly_budget_categories;
create policy "Users can insert own monthly budget categories"
on public.monthly_budget_categories
for insert
to authenticated
with check (
  exists (
    select 1
    from public.monthly_budgets
    where monthly_budgets.id = monthly_budget_categories.monthly_budget_id
      and monthly_budgets.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own monthly budget categories" on public.monthly_budget_categories;
create policy "Users can update own monthly budget categories"
on public.monthly_budget_categories
for update
to authenticated
using (
  exists (
    select 1
    from public.monthly_budgets
    where monthly_budgets.id = monthly_budget_categories.monthly_budget_id
      and monthly_budgets.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.monthly_budgets
    where monthly_budgets.id = monthly_budget_categories.monthly_budget_id
      and monthly_budgets.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own monthly budget categories" on public.monthly_budget_categories;
create policy "Users can delete own monthly budget categories"
on public.monthly_budget_categories
for delete
to authenticated
using (
  exists (
    select 1
    from public.monthly_budgets
    where monthly_budgets.id = monthly_budget_categories.monthly_budget_id
      and monthly_budgets.user_id = auth.uid()
  )
);

create or replace function public.upsert_monthly_budget(
  p_target_month date,
  p_budget_amount integer,
  p_category_ids uuid[]
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_user_id uuid;
  v_target_month date;
  v_budget_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_target_month := date_trunc('month', p_target_month::timestamp)::date;

  insert into public.monthly_budgets (
    user_id,
    target_month,
    budget_amount
  )
  values (
    v_user_id,
    v_target_month,
    p_budget_amount
  )
  on conflict (user_id, target_month)
  do update set
    budget_amount = excluded.budget_amount,
    updated_at = timezone('utc', now())
  returning id into v_budget_id;

  delete from public.monthly_budget_categories
  where monthly_budget_id = v_budget_id;

  if coalesce(array_length(p_category_ids, 1), 0) > 0 then
    insert into public.monthly_budget_categories (
      monthly_budget_id,
      category_id
    )
    select
      v_budget_id,
      category_id
    from (
      select distinct unnest(p_category_ids) as category_id
    ) distinct_categories
    on conflict (monthly_budget_id, category_id) do nothing;
  end if;

  return v_budget_id;
end;
$$;

grant execute on function public.upsert_monthly_budget(date, integer, uuid[]) to authenticated;
