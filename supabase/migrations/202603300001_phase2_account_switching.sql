create table if not exists public.household_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  slug text not null check (slug in ('atsuki', 'sara', 'shared')),
  name text not null check (name in ('あつき', 'さら', '共用')),
  color_key text not null check (color_key in ('blue', 'pink', 'blend')),
  sort_order integer not null check (sort_order between 1 and 3),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint household_accounts_user_slug_unique unique (user_id, slug)
);

create index if not exists household_accounts_user_id_sort_order_idx
  on public.household_accounts (user_id, sort_order);

drop trigger if exists set_household_accounts_updated_at on public.household_accounts;
create trigger set_household_accounts_updated_at
before update on public.household_accounts
for each row
execute function public.set_updated_at();

alter table public.household_accounts enable row level security;

drop policy if exists "Users can manage own household accounts" on public.household_accounts;
create policy "Users can manage own household accounts"
on public.household_accounts
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

with known_users as (
  select id as user_id
  from auth.users
  union
  select user_id from public.import_groups
  union
  select user_id from public.expense_drafts
  union
  select user_id from public.expenses
  union
  select user_id from public.classification_rules
  union
  select user_id from public.monthly_budgets
  union
  select user_id from public.user_preferences
)
insert into public.household_accounts (user_id, slug, name, color_key, sort_order)
select
  known_users.user_id,
  seed.slug,
  seed.name,
  seed.color_key,
  seed.sort_order
from known_users
cross join (
  values
    ('atsuki', 'あつき', 'blue', 1),
    ('sara', 'さら', 'pink', 2),
    ('shared', '共用', 'blend', 3)
) as seed(slug, name, color_key, sort_order)
on conflict (user_id, slug) do update
set
  name = excluded.name,
  color_key = excluded.color_key,
  sort_order = excluded.sort_order;

alter table public.import_groups
  add column if not exists account_id uuid references public.household_accounts (id);

alter table public.expense_drafts
  add column if not exists account_id uuid references public.household_accounts (id);

alter table public.expenses
  add column if not exists account_id uuid references public.household_accounts (id);

alter table public.classification_rules
  add column if not exists account_id uuid references public.household_accounts (id);

alter table public.monthly_budgets
  add column if not exists account_id uuid references public.household_accounts (id);

alter table public.user_preferences
  add column if not exists current_account_id uuid references public.household_accounts (id) on delete set null;

update public.import_groups ig
set account_id = accounts.id
from public.household_accounts accounts
where ig.account_id is null
  and accounts.user_id = ig.user_id
  and accounts.slug = 'atsuki';

update public.expense_drafts d
set account_id = coalesce(ig.account_id, accounts.id)
from public.import_groups ig,
     public.household_accounts accounts
where d.account_id is null
  and ig.id = d.import_group_id
  and accounts.user_id = d.user_id
  and accounts.slug = 'atsuki';

update public.expenses e
set account_id = coalesce(ig.account_id, accounts.id)
from public.import_groups ig,
     public.household_accounts accounts
where e.account_id is null
  and ig.id = e.import_group_id
  and accounts.user_id = e.user_id
  and accounts.slug = 'atsuki';

update public.classification_rules r
set account_id = accounts.id
from public.household_accounts accounts
where r.account_id is null
  and accounts.user_id = r.user_id
  and accounts.slug = 'atsuki';

update public.monthly_budgets mb
set account_id = accounts.id
from public.household_accounts accounts
where mb.account_id is null
  and accounts.user_id = mb.user_id
  and accounts.slug = 'atsuki';

update public.user_preferences up
set current_account_id = accounts.id
from public.household_accounts accounts
where up.current_account_id is null
  and accounts.user_id = up.user_id
  and accounts.slug = 'atsuki';

alter table public.import_groups
  alter column account_id set not null;

alter table public.expense_drafts
  alter column account_id set not null;

alter table public.expenses
  alter column account_id set not null;

alter table public.classification_rules
  alter column account_id set not null;

alter table public.monthly_budgets
  alter column account_id set not null;

create index if not exists import_groups_user_id_account_id_created_at_idx
  on public.import_groups (user_id, account_id, created_at desc);

create index if not exists expense_drafts_user_id_account_id_import_group_id_idx
  on public.expense_drafts (user_id, account_id, import_group_id);

create index if not exists expenses_user_id_account_id_occurred_on_idx
  on public.expenses (user_id, account_id, occurred_on desc);

create index if not exists classification_rules_user_id_account_id_item_idx
  on public.classification_rules (user_id, account_id, normalized_item_name, normalized_merchant_name);

create index if not exists monthly_budgets_user_id_account_id_target_month_idx
  on public.monthly_budgets (user_id, account_id, target_month desc);

alter table public.classification_rules
  drop constraint if exists classification_rules_unique;

alter table public.classification_rules
  add constraint classification_rules_unique unique (
    user_id,
    account_id,
    normalized_item_name,
    normalized_merchant_name
  );

alter table public.monthly_budgets
  drop constraint if exists monthly_budgets_unique_user_month;

alter table public.monthly_budgets
  add constraint monthly_budgets_unique_user_month unique (user_id, account_id, target_month);

create or replace function public.get_default_household_account_id(p_user_id uuid)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_account_id uuid;
begin
  select id
    into v_account_id
  from public.household_accounts
  where user_id = p_user_id
    and slug = 'atsuki'
  order by sort_order
  limit 1;

  return v_account_id;
end;
$$;

create or replace function public.confirm_import_group(p_import_group_id uuid)
returns table (expense_count integer)
language plpgsql
security invoker
as $$
declare
  v_user_id uuid;
  v_import_group public.import_groups%rowtype;
  v_expense_count integer := 0;
  v_now timestamptz := timezone('utc', now());
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
    into v_import_group
  from public.import_groups
  where id = p_import_group_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Import group not found';
  end if;

  if v_import_group.status <> 'draft' then
    raise exception 'Import group is not in draft status';
  end if;

  if not exists (
    select 1
    from public.expense_drafts
    where import_group_id = p_import_group_id
      and user_id = v_user_id
      and account_id = v_import_group.account_id
  ) then
    raise exception 'No draft rows found';
  end if;

  if exists (
    select 1
    from public.expense_drafts
    where import_group_id = p_import_group_id
      and user_id = v_user_id
      and account_id = v_import_group.account_id
      and (
        char_length(btrim(title)) = 0
        or amount is null
        or amount <= 0
        or suggested_category_id is null
      )
  ) then
    raise exception 'Draft rows are incomplete';
  end if;

  insert into public.expenses (
    user_id,
    account_id,
    import_group_id,
    occurred_on,
    merchant_name,
    title,
    amount,
    suggested_category_id,
    category_id,
    note,
    source_type,
    is_category_corrected
  )
  select
    d.user_id,
    d.account_id,
    d.import_group_id,
    coalesce(d.occurred_on, v_import_group.occurred_on, v_now::date),
    d.merchant_name,
    btrim(d.title),
    d.amount,
    d.suggested_category_id,
    d.suggested_category_id,
    nullif(btrim(d.note), ''),
    d.source_type,
    false
  from public.expense_drafts d
  where d.import_group_id = p_import_group_id
    and d.user_id = v_user_id
    and d.account_id = v_import_group.account_id
  order by d.line_index, d.created_at;

  get diagnostics v_expense_count = row_count;

  insert into public.classification_rules (
    user_id,
    account_id,
    normalized_item_name,
    normalized_merchant_name,
    category_id,
    rule_source,
    usage_count,
    last_used_at
  )
  select
    d.user_id,
    d.account_id,
    lower(regexp_replace(btrim(d.title), '\s+', ' ', 'g')),
    lower(regexp_replace(coalesce(btrim(d.merchant_name), ''), '\s+', ' ', 'g')),
    d.suggested_category_id,
    'user_confirmation',
    1,
    v_now
  from public.expense_drafts d
  where d.import_group_id = p_import_group_id
    and d.user_id = v_user_id
    and d.account_id = v_import_group.account_id
  on conflict (user_id, account_id, normalized_item_name, normalized_merchant_name)
  do update
  set
    category_id = excluded.category_id,
    rule_source = excluded.rule_source,
    usage_count = public.classification_rules.usage_count + 1,
    last_used_at = excluded.last_used_at;

  update public.import_groups
  set
    status = 'confirmed',
    confirmed_at = v_now,
    title = coalesce(
      nullif(title, ''),
      (
        select max(nullif(btrim(merchant_name), ''))
        from public.expense_drafts
        where import_group_id = p_import_group_id
          and user_id = v_user_id
          and account_id = v_import_group.account_id
      ),
      title
    ),
    occurred_on = coalesce(
      occurred_on,
      (
        select min(coalesce(d.occurred_on, v_now::date))
        from public.expense_drafts d
        where d.import_group_id = p_import_group_id
          and d.user_id = v_user_id
          and d.account_id = v_import_group.account_id
      )
    )
  where id = p_import_group_id
    and user_id = v_user_id;

  delete from public.expense_drafts
  where import_group_id = p_import_group_id
    and user_id = v_user_id
    and account_id = v_import_group.account_id;

  return query select v_expense_count;
end;
$$;

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
  v_account_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select current_account_id
    into v_account_id
  from public.user_preferences
  where user_id = v_user_id;

  if v_account_id is null then
    v_account_id := public.get_default_household_account_id(v_user_id);
  end if;

  if v_account_id is null then
    raise exception 'Account not found';
  end if;

  v_target_month := date_trunc('month', p_target_month::timestamp)::date;

  insert into public.monthly_budgets (
    user_id,
    account_id,
    target_month,
    budget_amount
  )
  values (
    v_user_id,
    v_account_id,
    v_target_month,
    p_budget_amount
  )
  on conflict (user_id, account_id, target_month)
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

grant execute on function public.get_default_household_account_id(uuid) to authenticated;
