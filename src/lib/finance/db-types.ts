import type { ImportGroupStatus, RuleSource, SourceType } from "@/lib/finance/types";

export type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type HouseholdAccountRow = {
  id: string;
  user_id: string;
  slug: "atsuki" | "sara" | "shared";
  name: string;
  color_key: "blue" | "pink" | "blend";
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ImportGroupRow = {
  id: string;
  user_id: string;
  account_id: string;
  recurring_expense_id: string | null;
  source_type: SourceType;
  status: ImportGroupStatus;
  title: string | null;
  occurred_on: string | null;
  metadata: Record<string, unknown>;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ExpenseDraftRow = {
  id: string;
  user_id: string;
  account_id: string;
  import_group_id: string;
  line_index: number;
  occurred_on: string | null;
  merchant_name: string | null;
  title: string;
  amount: number | null;
  suggested_category_id: string | null;
  category_id?: string | null;
  note: string | null;
  source_type: SourceType;
  needs_review: boolean;
  raw_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ExpenseRow = {
  id: string;
  user_id: string;
  account_id: string;
  import_group_id: string;
  recurring_expense_id: string | null;
  occurred_on: string;
  merchant_name: string | null;
  title: string;
  amount: number;
  suggested_category_id: string | null;
  category_id: string;
  note: string | null;
  source_type: SourceType;
  is_category_corrected: boolean;
  created_at: string;
  updated_at: string;
};

export type ClassificationRuleRow = {
  id: string;
  user_id: string;
  account_id: string;
  normalized_item_name: string;
  normalized_merchant_name: string;
  category_id: string;
  rule_source: RuleSource;
  usage_count: number;
  last_used_at: string;
  created_at: string;
  updated_at: string;
};

export type MonthlyBudgetRow = {
  id: string;
  user_id: string;
  account_id: string;
  target_month: string;
  budget_amount: number;
  template_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MonthlyBudgetCategoryRow = {
  id: string;
  monthly_budget_id: string;
  category_id: string;
  budget_amount: number;
  created_at: string;
  updated_at: string;
};

export type BudgetTemplateRow = {
  id: string;
  user_id: string;
  account_id: string;
  name: string | null;
  total_budget: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type BudgetTemplateCategoryRow = {
  id: string;
  template_id: string;
  category_id: string;
  budget_amount: number;
  created_at: string;
  updated_at: string;
};

export type UserPreferenceRow = {
  id: string;
  user_id: string;
  theme_name: string;
  current_account_id: string | null;
  created_at: string;
  updated_at: string;
};

export type RecurringExpenseRow = {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string;
  name: string;
  amount: number;
  schedule_day: number;
  schedule_time: string;
  memo: string | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  last_applied_at: string | null;
  next_scheduled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RecurringExpenseLogRow = {
  id: string;
  user_id: string;
  account_id: string;
  recurring_expense_id: string;
  applied_import_group_id: string | null;
  applied_expense_id: string | null;
  executed_at: string;
  target_month: string;
  result_type: "applied" | "skipped" | "inactive" | "already_applied" | "out_of_range";
  amount: number | null;
  reason: string | null;
  created_at: string;
};
