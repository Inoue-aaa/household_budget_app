import { getAuthenticatedAccountContext } from "@/lib/accounts/queries";
import type { RecurringExpenseLogRow, RecurringExpenseRow } from "@/lib/finance/db-types";
import type {
  RecurringExpenseListItem,
  RecurringExpenseLogListItem,
  RecurringExpensesPageSnapshot,
} from "@/lib/finance/types";
import { listCategories } from "@/lib/finance/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { computeNextScheduledAt } from "@/features/fixed-expenses/schedule";

export async function getRecurringExpensesPageSnapshot(): Promise<RecurringExpensesPageSnapshot | null> {
  const accountContext = await getAuthenticatedAccountContext();

  if (!accountContext) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const categories = await listCategories();
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]));

  const [{ data: expenseRows, error: expenseError }, { data: logRows, error: logError }] =
    await Promise.all([
      supabase
        .from("recurring_expenses")
        .select(
          "id, user_id, account_id, category_id, name, amount, schedule_day, schedule_time, memo, is_active, start_date, end_date, last_applied_at, next_scheduled_at, created_at, updated_at",
        )
        .eq("account_id", accountContext.currentAccount.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("recurring_expense_logs")
        .select(
          "id, user_id, account_id, recurring_expense_id, applied_import_group_id, applied_expense_id, executed_at, target_month, result_type, amount, reason, created_at",
        )
        .eq("account_id", accountContext.currentAccount.id)
        .order("executed_at", { ascending: false })
        .limit(12),
    ]);

  if (expenseError || logError) {
    return {
      account: accountContext,
      items: [],
      logs: [],
      totalCount: 0,
      activeCount: 0,
    };
  }

  const recurringExpenses = (expenseRows ?? []) as RecurringExpenseRow[];
  const recurringNameMap = new Map(recurringExpenses.map((item) => [item.id, item.name]));

  const items: RecurringExpenseListItem[] = recurringExpenses.map((item) => ({
    id: item.id,
    name: item.name,
    amount: item.amount,
    categoryId: item.category_id,
    categoryName: categoryMap.get(item.category_id) ?? "未設定カテゴリ",
    scheduleDay: item.schedule_day,
    scheduleTime: item.schedule_time.slice(0, 5),
    memo: item.memo,
    isActive: item.is_active,
    startDate: item.start_date,
    endDate: item.end_date,
    lastAppliedAt: item.last_applied_at,
    nextScheduledAt: item.next_scheduled_at ?? computeNextScheduledAt(item),
  }));

  const logs: RecurringExpenseLogListItem[] = ((logRows ?? []) as RecurringExpenseLogRow[]).map(
    (log) => ({
      id: log.id,
      recurringExpenseId: log.recurring_expense_id,
      recurringExpenseName:
        recurringNameMap.get(log.recurring_expense_id) ?? "削除された固定費",
      executedAt: log.executed_at,
      targetMonth: log.target_month,
      resultType: log.result_type,
      amount: log.amount,
      reason: log.reason,
    }),
  );

  return {
    account: accountContext,
    items,
    logs,
    totalCount: items.length,
    activeCount: items.filter((item) => item.isActive).length,
  };
}

export async function getRecurringExpenseById(recurringExpenseId: string) {
  const accountContext = await getAuthenticatedAccountContext();

  if (!accountContext) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("recurring_expenses")
    .select(
      "id, user_id, account_id, category_id, name, amount, schedule_day, schedule_time, memo, is_active, start_date, end_date, last_applied_at, next_scheduled_at, created_at, updated_at",
    )
    .eq("account_id", accountContext.currentAccount.id)
    .eq("id", recurringExpenseId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as RecurringExpenseRow;
}
