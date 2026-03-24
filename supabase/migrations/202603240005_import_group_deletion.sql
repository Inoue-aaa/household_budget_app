create or replace function public.delete_import_group(p_import_group_id uuid)
returns table (
  deleted_import_group_id uuid,
  deleted_status text
)
language plpgsql
security invoker
as $$
declare
  v_user_id uuid;
  v_import_group public.import_groups%rowtype;
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

  if v_import_group.status not in ('draft', 'confirmed', 'discarded') then
    raise exception 'Unsupported import group status';
  end if;

  delete from public.import_groups
  where id = p_import_group_id
    and user_id = v_user_id;

  return query
  select v_import_group.id, v_import_group.status;
end;
$$;

grant execute on function public.delete_import_group(uuid) to authenticated;
