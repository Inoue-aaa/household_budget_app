create index if not exists expense_drafts_import_group_id_line_index_idx
  on public.expense_drafts (import_group_id, line_index);

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
  ) then
    raise exception 'No draft rows found';
  end if;

  if exists (
    select 1
    from public.expense_drafts
    where import_group_id = p_import_group_id
      and user_id = v_user_id
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
  order by d.line_index, d.created_at;

  get diagnostics v_expense_count = row_count;

  insert into public.classification_rules (
    user_id,
    normalized_item_name,
    normalized_merchant_name,
    category_id,
    rule_source,
    usage_count,
    last_used_at
  )
  select
    d.user_id,
    lower(regexp_replace(btrim(d.title), '\s+', ' ', 'g')),
    lower(regexp_replace(coalesce(btrim(d.merchant_name), ''), '\s+', ' ', 'g')),
    d.suggested_category_id,
    'user_confirmation',
    1,
    v_now
  from public.expense_drafts d
  where d.import_group_id = p_import_group_id
    and d.user_id = v_user_id
  on conflict (user_id, normalized_item_name, normalized_merchant_name)
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
      )
    )
  where id = p_import_group_id
    and user_id = v_user_id;

  delete from public.expense_drafts
  where import_group_id = p_import_group_id
    and user_id = v_user_id;

  return query select v_expense_count;
end;
$$;

grant execute on function public.confirm_import_group(uuid) to authenticated;
