alter table public.categories
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at
before update on public.categories
for each row
execute function public.set_updated_at();

create index if not exists categories_active_sort_order_idx
  on public.categories (is_active, sort_order);

create index if not exists import_groups_user_id_status_created_at_idx
  on public.import_groups (user_id, status, created_at desc);

create index if not exists import_groups_user_id_source_type_created_at_idx
  on public.import_groups (user_id, source_type, created_at desc);

create index if not exists expense_drafts_user_id_source_type_idx
  on public.expense_drafts (user_id, source_type);

create index if not exists expense_drafts_suggested_category_id_idx
  on public.expense_drafts (suggested_category_id);

create index if not exists expenses_user_id_category_id_occurred_on_idx
  on public.expenses (user_id, category_id, occurred_on desc);

create index if not exists expenses_category_id_idx
  on public.expenses (category_id);

create index if not exists classification_rules_category_id_idx
  on public.classification_rules (category_id);

create index if not exists classification_rules_user_id_last_used_at_idx
  on public.classification_rules (user_id, last_used_at desc);

alter table public.import_groups
  drop constraint if exists import_groups_confirmed_status_check;

alter table public.import_groups
  add constraint import_groups_confirmed_status_check
  check (
    (status = 'confirmed' and confirmed_at is not null)
    or (status in ('draft', 'discarded'))
  );

alter table public.expense_drafts
  drop constraint if exists expense_drafts_amount_positive_check;

alter table public.expense_drafts
  add constraint expense_drafts_amount_positive_check
  check (amount is null or amount > 0);

alter table public.classification_rules
  drop constraint if exists classification_rules_item_name_not_blank_check;

alter table public.classification_rules
  add constraint classification_rules_item_name_not_blank_check
  check (char_length(btrim(normalized_item_name)) > 0);

drop policy if exists "Users can manage own import groups" on public.import_groups;
drop policy if exists "Users can manage own expense drafts" on public.expense_drafts;
drop policy if exists "Users can manage own expenses" on public.expenses;
drop policy if exists "Users can manage own classification rules" on public.classification_rules;

create policy "Users can select own import groups"
on public.import_groups
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own import groups"
on public.import_groups
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own import groups"
on public.import_groups
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own import groups"
on public.import_groups
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can select own expense drafts"
on public.expense_drafts
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own expense drafts"
on public.expense_drafts
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own expense drafts"
on public.expense_drafts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own expense drafts"
on public.expense_drafts
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can select own expenses"
on public.expenses
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own expenses"
on public.expenses
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own expenses"
on public.expenses
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own expenses"
on public.expenses
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can select own classification rules"
on public.classification_rules
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own classification rules"
on public.classification_rules
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own classification rules"
on public.classification_rules
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own classification rules"
on public.classification_rules
for delete
to authenticated
using (auth.uid() = user_id);
