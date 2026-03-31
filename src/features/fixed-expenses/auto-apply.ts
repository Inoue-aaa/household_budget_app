import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportGroupRow, RecurringExpenseLogRow, RecurringExpenseRow } from "@/lib/finance/db-types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  computeNextScheduledAt,
  getCurrentMonthOccurrence,
  isOccurrenceWithinRange,
} from "@/features/fixed-expenses/schedule";

type AutoApplySummary = {
  processedCount: number;
  appliedCount: number;
  alreadyAppliedCount: number;
  outOfRangeCount: number;
  inactiveCount: number;
};

type RecurringExpenseLogResult = RecurringExpenseLogRow["result_type"];

function getJstMonthLabel(reference: Date) {
  const jst = new Date(reference.getTime() + 9 * 60 * 60 * 1000);
  const year = jst.getUTCFullYear();
  const month = String(jst.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

function getMonthEnd(targetMonth: string) {
  const [yearText, monthText] = targetMonth.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const end = new Date(Date.UTC(year, month, 0));
  const endYear = end.getUTCFullYear();
  const endMonth = String(end.getUTCMonth() + 1).padStart(2, "0");
  const endDay = String(end.getUTCDate()).padStart(2, "0");
  return `${endYear}-${endMonth}-${endDay}`;
}

async function upsertRecurringExpenseLog(
  supabase: SupabaseClient,
  log: {
    user_id: string;
    account_id: string;
    recurring_expense_id: string;
    target_month: string;
    result_type: RecurringExpenseLogResult;
    amount: number | null;
    reason: string | null;
    applied_import_group_id?: string | null;
    applied_expense_id?: string | null;
    executed_at?: string;
  },
) {
  const { error } = await supabase.from("recurring_expense_logs").upsert(
    {
      ...log,
      executed_at: log.executed_at ?? new Date().toISOString(),
    },
    {
      onConflict: "recurring_expense_id,target_month,result_type",
    },
  );

  if (error) {
    throw error;
  }
}

async function createRecurringExpenseEntries(
  supabase: SupabaseClient,
  recurringExpense: RecurringExpenseRow,
  occurredOn: string,
  targetMonth: string,
) {
  const executedAt = new Date().toISOString();

  const { data: importGroup, error: importGroupError } = await supabase
    .from("import_groups")
    .insert({
      user_id: recurringExpense.user_id,
      account_id: recurringExpense.account_id,
      recurring_expense_id: recurringExpense.id,
      source_type: "manual",
      status: "confirmed",
      title: recurringExpense.name,
      occurred_on: occurredOn,
      confirmed_at: executedAt,
      metadata: {
        origin: "recurring-expense",
        recurringExpenseId: recurringExpense.id,
        targetMonth,
      },
    })
    .select(
      "id, user_id, account_id, recurring_expense_id, source_type, status, title, occurred_on, metadata, confirmed_at, created_at, updated_at",
    )
    .single();

  if (importGroupError || !importGroup) {
    throw importGroupError ?? new Error("Failed to create recurring import group.");
  }

  const { data: expense, error: expenseError } = await supabase
    .from("expenses")
    .insert({
      user_id: recurringExpense.user_id,
      account_id: recurringExpense.account_id,
      import_group_id: (importGroup as ImportGroupRow).id,
      recurring_expense_id: recurringExpense.id,
      occurred_on: occurredOn,
      merchant_name: null,
      title: recurringExpense.name,
      amount: recurringExpense.amount,
      suggested_category_id: recurringExpense.category_id,
      category_id: recurringExpense.category_id,
      note: recurringExpense.memo,
      source_type: "manual",
      is_category_corrected: false,
    })
    .select("id")
    .single<{ id: string }>();

  if (expenseError || !expense) {
    await supabase.from("import_groups").delete().eq("id", (importGroup as ImportGroupRow).id);
    throw expenseError ?? new Error("Failed to create recurring expense.");
  }

  return {
    importGroupId: (importGroup as ImportGroupRow).id,
    expenseId: expense.id,
  };
}

async function handleRecurringExpense(
  supabase: SupabaseClient,
  recurringExpense: RecurringExpenseRow,
  reference: Date,
) {
  const targetMonth = getJstMonthLabel(reference);
  const occurrence = getCurrentMonthOccurrence(recurringExpense, reference);
  const nextScheduledAt = computeNextScheduledAt(recurringExpense, reference);
  const executedAt = new Date().toISOString();

  if (!recurringExpense.is_active) {
    await upsertRecurringExpenseLog(supabase, {
      user_id: recurringExpense.user_id,
      account_id: recurringExpense.account_id,
      recurring_expense_id: recurringExpense.id,
      target_month: targetMonth,
      result_type: "inactive",
      amount: recurringExpense.amount,
      reason: "inactive recurring expense",
      executed_at: executedAt,
    });
    return "inactive" as const;
  }

  if (!isOccurrenceWithinRange(recurringExpense, occurrence.occurredOn)) {
    await upsertRecurringExpenseLog(supabase, {
      user_id: recurringExpense.user_id,
      account_id: recurringExpense.account_id,
      recurring_expense_id: recurringExpense.id,
      target_month: targetMonth,
      result_type: "out_of_range",
      amount: recurringExpense.amount,
      reason: "outside active date range",
      executed_at: executedAt,
    });
    await supabase
      .from("recurring_expenses")
      .update({ next_scheduled_at: nextScheduledAt })
      .eq("id", recurringExpense.id);
    return "out_of_range" as const;
  }

  if (occurrence.scheduledAt.getTime() > reference.getTime()) {
    await supabase
      .from("recurring_expenses")
      .update({ next_scheduled_at: nextScheduledAt })
      .eq("id", recurringExpense.id);
    return "skipped" as const;
  }

  const { data: existingApplied } = await supabase
    .from("recurring_expense_logs")
    .select("id")
    .eq("recurring_expense_id", recurringExpense.id)
    .eq("target_month", targetMonth)
    .eq("result_type", "applied")
    .maybeSingle();

  const { data: existingExpense } = await supabase
    .from("expenses")
    .select("id")
    .eq("recurring_expense_id", recurringExpense.id)
    .gte("occurred_on", targetMonth)
    .lte("occurred_on", getMonthEnd(targetMonth))
    .limit(1)
    .maybeSingle();

  if (existingApplied || existingExpense) {
    await upsertRecurringExpenseLog(supabase, {
      user_id: recurringExpense.user_id,
      account_id: recurringExpense.account_id,
      recurring_expense_id: recurringExpense.id,
      target_month: targetMonth,
      result_type: "already_applied",
      amount: recurringExpense.amount,
      reason: "already applied for this month",
      executed_at: executedAt,
    });
    await supabase
      .from("recurring_expenses")
      .update({ next_scheduled_at: nextScheduledAt })
      .eq("id", recurringExpense.id);
    return "already_applied" as const;
  }

  const created = await createRecurringExpenseEntries(
    supabase,
    recurringExpense,
    occurrence.occurredOn,
    targetMonth,
  );

  const recalculatedNext = computeNextScheduledAt(recurringExpense, new Date(reference.getTime() + 60_000));

  await upsertRecurringExpenseLog(supabase, {
    user_id: recurringExpense.user_id,
    account_id: recurringExpense.account_id,
    recurring_expense_id: recurringExpense.id,
    target_month: targetMonth,
    result_type: "applied",
    amount: recurringExpense.amount,
    reason: "applied automatically",
    applied_import_group_id: created.importGroupId,
    applied_expense_id: created.expenseId,
    executed_at: executedAt,
  });

  await supabase
    .from("recurring_expenses")
    .update({
      last_applied_at: executedAt,
      next_scheduled_at: recalculatedNext,
    })
    .eq("id", recurringExpense.id);

  return "applied" as const;
}

export async function runRecurringExpenseAutoApply(reference = new Date()): Promise<AutoApplySummary> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("recurring_expenses")
    .select(
      "id, user_id, account_id, category_id, name, amount, schedule_day, schedule_time, memo, is_active, start_date, end_date, last_applied_at, next_scheduled_at, created_at, updated_at",
    );

  if (error) {
    throw error;
  }

  const items = (data ?? []) as RecurringExpenseRow[];
  const summary: AutoApplySummary = {
    processedCount: items.length,
    appliedCount: 0,
    alreadyAppliedCount: 0,
    outOfRangeCount: 0,
    inactiveCount: 0,
  };

  for (const item of items) {
    const result = await handleRecurringExpense(supabase, item, reference);

    if (result === "applied") {
      summary.appliedCount += 1;
    } else if (result === "already_applied") {
      summary.alreadyAppliedCount += 1;
    } else if (result === "out_of_range") {
      summary.outOfRangeCount += 1;
    } else if (result === "inactive") {
      summary.inactiveCount += 1;
    }
  }

  return summary;
}
