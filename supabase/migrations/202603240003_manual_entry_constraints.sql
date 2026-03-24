alter table public.categories
  drop constraint if exists categories_sort_order_positive_check;

alter table public.categories
  add constraint categories_sort_order_positive_check
  check (sort_order > 0);

alter table public.expense_drafts
  drop constraint if exists expense_drafts_title_not_blank_check;

alter table public.expense_drafts
  add constraint expense_drafts_title_not_blank_check
  check (char_length(btrim(title)) > 0);

alter table public.expenses
  drop constraint if exists expenses_title_not_blank_check;

alter table public.expenses
  add constraint expenses_title_not_blank_check
  check (char_length(btrim(title)) > 0);

alter table public.expenses
  drop constraint if exists expenses_amount_reasonable_check;

alter table public.expenses
  add constraint expenses_amount_reasonable_check
  check (amount > 0 and amount <= 9999999);

alter table public.classification_rules
  drop constraint if exists classification_rules_usage_count_positive_check;

alter table public.classification_rules
  add constraint classification_rules_usage_count_positive_check
  check (usage_count >= 1);
