import { getAuthenticatedAccountContext } from "@/lib/accounts/queries";
import { INITIAL_CATEGORIES } from "@/lib/finance/categories";
import type {
  BudgetTemplateCategoryRow,
  BudgetTemplateRow,
  CategoryRow,
  ExpenseDraftRow,
  ExpenseRow,
  ImportGroupRow,
  MonthlyBudgetCategoryRow,
  MonthlyBudgetRow,
} from "@/lib/finance/db-types";
import type {
  AnalysisBudgetComparison,
  AnalysisCategoryTotalItem,
  AnalysisPeriodComparison,
  AnalysisSnapshot,
  AnalysisTopExpenseItem,
  AnalysisTopMerchantItem,
  AnalysisTrendItem,
  BudgetCategoryAllocation,
  BudgetDetailCategoryItem,
  BudgetTemplateSnapshot,
  CategorySummaryItem,
  CategoryBreakdownSnapshot,
  CategoryOption,
  CurrentAccountSnapshot,
  DailyExpensesSnapshot,
  DailySpendingItem,
  DashboardSnapshot,
  DraftReviewItem,
  DraftReviewSnapshot,
  ExpenseHistoryDaySummary,
  ExpenseHistorySnapshot,
  ExpenseImportGroupSummary,
  ExpenseListItem,
  ExpensesPageSnapshot,
  ExpensesReportSnapshot,
  MonthlySummarySnapshot,
  MonthlySummaryCategoryItem,
  YearlySpendingTrendItem,
  YearlySpendingTrendSnapshot,
  MonthlyBudgetDetailSnapshot,
  MonthlyBudgetOverview,
  OcrDebugInfo,
  PendingImportGroupSummary,
  PendingImportsPageSnapshot,
  RecurringExpenseCandidateItem,
  ReportMonthOption
} from "@/lib/finance/types";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { formatDisplayDate, formatMonthLabel, monthDateRange, monthStartDateString } from "@/lib/utils/format";
import { getUpcomingOccurrenceWithinDays } from "@/features/fixed-expenses/schedule";

function createFallbackAccountSnapshot(): CurrentAccountSnapshot {
  return {
    currentAccount: {
      id: "fallback-account",
      slug: "atsuki",
      name: "あつき",
      colorKey: "blue",
      sortOrder: 1,
    },
    accounts: [
      {
        id: "fallback-account",
        slug: "atsuki",
        name: "あつき",
        colorKey: "blue",
        sortOrder: 1,
      },
    ],
  };
}

function mapCategoryOptions(
  categories: Pick<CategoryRow, "id" | "slug" | "name" | "sort_order" | "is_active">[]
): CategoryOption[] {
  return categories.map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    sortOrder: category.sort_order,
    isActive: category.is_active
  }));
}

function mapExpenseRows(
  rows: Pick<
    ExpenseRow,
    | "id"
    | "title"
    | "amount"
    | "occurred_on"
    | "merchant_name"
      | "note"
      | "import_group_id"
      | "recurring_expense_id"
      | "category_id"
      | "source_type"
  >[],
  categoryMap: Map<string, string>
): ExpenseListItem[] {
  return rows.map((expense) => ({
    id: expense.id,
    title: expense.title,
    amount: expense.amount,
    occurredOn: expense.occurred_on,
    merchantName: expense.merchant_name,
    note: expense.note,
    importGroupId: expense.import_group_id,
    recurringExpenseId: expense.recurring_expense_id,
    categoryId: expense.category_id,
    categoryName: categoryMap.get(expense.category_id) ?? "未設定カテゴリ",
    sourceType: expense.source_type
  }));
}

function buildPendingImportGroups(
  groups: Pick<ImportGroupRow, "id" | "source_type" | "created_at" | "occurred_on" | "title">[],
  drafts: Pick<
    ExpenseDraftRow,
    "id" | "import_group_id" | "merchant_name" | "title" | "created_at" | "line_index"
  >[]
): PendingImportGroupSummary[] {
  const draftsByGroup = new Map<string, typeof drafts>();

  for (const draft of drafts) {
    const current = draftsByGroup.get(draft.import_group_id) ?? [];
    current.push(draft);
    draftsByGroup.set(draft.import_group_id, current);
  }

  return groups
    .map((group) => {
      const relatedDrafts =
        draftsByGroup.get(group.id)?.sort((left, right) => left.line_index - right.line_index) ?? [];
      const firstDraft = relatedDrafts[0];

      return {
        importGroupId: group.id,
        sourceType: group.source_type,
        createdAt: group.created_at,
        occurredOn: group.occurred_on,
        representativeLabel:
          firstDraft?.merchant_name ?? firstDraft?.title ?? group.title ?? "未確認の取り込み",
        draftCount: relatedDrafts.length
      };
    })
    .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1));
}

function mapOcrDebugInfo(metadata: Record<string, unknown> | null | undefined): OcrDebugInfo | null {
  const ocr = metadata?.ocr;

  if (!ocr || typeof ocr !== "object") {
    return null;
  }

  const typedOcr = ocr as Record<string, unknown>;
  const providerMode = typedOcr.providerMode;
  const requestedProviderMode = typedOcr.requestedProviderMode;

  const isValidMode = (value: unknown) =>
    value === "dummy" || value === "real" || value === "ollama_local";

  if (!isValidMode(providerMode) || !isValidMode(requestedProviderMode)) {
    return null;
  }

  return {
    requestedProviderMode,
    providerMode,
    providerName: typeof typedOcr.providerName === "string" ? typedOcr.providerName : null,
    fallbackUsed: typedOcr.fallbackUsed === true,
    errorCode: typeof typedOcr.errorCode === "string" ? typedOcr.errorCode : null
  };
}

function buildDailySpending(
  date: Date,
  expenses: Pick<ExpenseRow, "occurred_on" | "amount">[]
): DailySpendingItem[] {
  const year = date.getFullYear();
  const monthIndex = date.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const amountMap = new Map<string, number>();

  for (const expense of expenses) {
    amountMap.set(expense.occurred_on, (amountMap.get(expense.occurred_on) ?? 0) + expense.amount);
  }

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const dateString = new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);

    return {
      date: dateString,
      day,
      amount: amountMap.get(dateString) ?? 0
    };
  });
}

function resolveMonthDate(month?: string) {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    return new Date(`${month}-01T00:00:00`);
  }

  return new Date();
}

function buildAvailableMonths(
  expenses: Pick<ExpenseRow, "occurred_on">[],
  fallbackDate: Date
): ReportMonthOption[] {
  const months = new Set<string>([monthStartDateString(fallbackDate).slice(0, 7)]);

  for (const expense of expenses) {
    months.add(expense.occurred_on.slice(0, 7));
  }

  return Array.from(months)
    .sort((left, right) => (left < right ? 1 : -1))
    .map((value) => ({
      value,
      label: formatMonthLabel(`${value}-01`)
    }));
}

function createEmptyBudgetOverview(date: Date): MonthlyBudgetOverview {
  const targetMonth = monthStartDateString(date);

  return {
    targetMonth,
    monthLabel: formatMonthLabel(targetMonth),
    monthlyBudget: null,
    selectedCategoryIds: [],
    selectedCategories: [],
    spentAmount: 0,
    remainingAmount: null,
    usageRate: null,
    isOverBudget: false,
    hasBudget: false,
    hasSelectedCategories: false
  };
}

function createFallbackBudgetDetailSnapshot(date: Date): MonthlyBudgetDetailSnapshot {
  return {
    account: createFallbackAccountSnapshot(),
    targetMonth: monthStartDateString(date),
    monthLabel: formatMonthLabel(monthStartDateString(date)),
    templateId: null,
    monthlyBudgetId: null,
    totalBudget: null,
    totalSpent: 0,
    totalRemaining: null,
    totalUsageRate: null,
    hasBudget: false,
    tracksSelectedCategories: false,
    categoryItems: [],
  };
}

async function getDefaultBudgetTemplateRows(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  accountContext: NonNullable<Awaited<ReturnType<typeof getAuthenticatedAccountContext>>>,
) {
  const { data: template, error: templateError } = await supabase
    .from("budget_templates")
    .select("id, user_id, account_id, name, total_budget, is_default, created_at, updated_at")
    .eq("account_id", accountContext.currentAccount.id)
    .eq("is_default", true)
    .maybeSingle();

  if (templateError || !template) {
    return {
      template: null,
      categories: [] as BudgetTemplateCategoryRow[],
    };
  }

  const { data: templateCategories, error: templateCategoriesError } = await supabase
    .from("budget_template_categories")
    .select("id, template_id, category_id, budget_amount, created_at, updated_at")
    .eq("template_id", template.id)
    .order("created_at", { ascending: true });

  return {
    template: template as BudgetTemplateRow,
    categories:
      !templateCategoriesError && templateCategories
        ? (templateCategories as BudgetTemplateCategoryRow[])
        : [],
  };
}

async function getMonthlyBudgetRows(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  accountContext: NonNullable<Awaited<ReturnType<typeof getAuthenticatedAccountContext>>>,
  targetMonth: string,
) {
  const { data: budget, error: budgetError } = await supabase
    .from("monthly_budgets")
    .select("id, user_id, account_id, target_month, budget_amount, template_id, created_at, updated_at")
    .eq("target_month", targetMonth)
    .eq("account_id", accountContext.currentAccount.id)
    .maybeSingle();

  if (budgetError || !budget) {
    return {
      budget: null,
      categories: [] as MonthlyBudgetCategoryRow[],
    };
  }

  const { data: categories, error: categoriesError } = await supabase
    .from("monthly_budget_categories")
    .select("id, monthly_budget_id, category_id, budget_amount, created_at, updated_at")
    .eq("monthly_budget_id", budget.id)
    .order("created_at", { ascending: true });

  return {
    budget: budget as MonthlyBudgetRow,
    categories:
      !categoriesError && categories ? (categories as MonthlyBudgetCategoryRow[]) : [],
  };
}

async function ensureMonthlyBudgetRows(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  accountContext: NonNullable<Awaited<ReturnType<typeof getAuthenticatedAccountContext>>>,
  targetMonth: string,
) {
  const existing = await getMonthlyBudgetRows(supabase, accountContext, targetMonth);

  if (existing.budget) {
    return existing;
  }

  const templateRows = await getDefaultBudgetTemplateRows(supabase, accountContext);

  if (!templateRows.template) {
    return existing;
  }

  const { data: insertedBudget, error: insertError } = await supabase
    .from("monthly_budgets")
    .insert({
      user_id: accountContext.userId,
      account_id: accountContext.currentAccount.id,
      target_month: targetMonth,
      budget_amount: templateRows.template.total_budget,
      template_id: templateRows.template.id,
    })
    .select("id, user_id, account_id, target_month, budget_amount, template_id, created_at, updated_at")
    .single();

  if (insertError || !insertedBudget) {
    return existing;
  }

  const categoryRows = templateRows.categories
    .filter((row) => row.budget_amount > 0)
    .map((row) => ({
      monthly_budget_id: insertedBudget.id,
      category_id: row.category_id,
      budget_amount: row.budget_amount,
    }));

  if (categoryRows.length > 0) {
    await supabase.from("monthly_budget_categories").insert(categoryRows);
  }

  return getMonthlyBudgetRows(supabase, accountContext, targetMonth);
}

function mapBudgetCategoryAllocations(
  rows: { category_id: string; budget_amount: number }[],
  categoryMap: Map<string, string>,
): BudgetCategoryAllocation[] {
  return rows
    .map((row) => ({
      categoryId: row.category_id,
      categoryName: categoryMap.get(row.category_id) ?? "未設定カテゴリ",
      budgetAmount: row.budget_amount,
    }))
    .sort((left, right) => right.budgetAmount - left.budgetAmount);
}

function createEmptyReportSnapshot(
  date: Date,
  account: CurrentAccountSnapshot
): ExpensesReportSnapshot {
  const targetMonth = monthStartDateString(date).slice(0, 7);

  return {
    account,
    targetMonth,
    monthLabel: formatMonthLabel(`${targetMonth}-01`),
    totalAmount: 0,
    dailySpending: [],
    availableMonths: [{ value: targetMonth, label: formatMonthLabel(`${targetMonth}-01`) }]
  };
}

function createEmptyMonthlySummarySnapshot(
  date: Date,
  account: CurrentAccountSnapshot
): MonthlySummarySnapshot {
  const targetMonth = monthStartDateString(date).slice(0, 7);

  return {
    account,
    targetMonth,
    monthLabel: formatMonthLabel(`${targetMonth}-01`),
    totalAmount: 0,
    previousMonthAmount: 0,
    differenceFromPreviousMonth: 0,
    budgetAmount: null,
    differenceFromBudget: null,
    usageRate: null,
    fixedAmount: 0,
    variableAmount: 0,
    topCategories: [],
    availableMonths: [{ value: targetMonth, label: formatMonthLabel(`${targetMonth}-01`) }]
  };
}

function isIsoDateString(value?: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseUtcDate(dateString: string) {
  return new Date(`${dateString}T00:00:00Z`);
}

function formatUtcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDateString(dateString: string, days: number) {
  const date = parseUtcDate(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return formatUtcDate(date);
}

function diffDaysInclusive(startDate: string, endDate: string) {
  const start = parseUtcDate(startDate);
  const end = parseUtcDate(endDate);
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function formatAnalysisPeriodLabel(startDate: string, endDate: string) {
  return `${formatDisplayDate(startDate)} 〜 ${formatDisplayDate(endDate)}`;
}

function resolveAnalysisDateRange(startDate?: string, endDate?: string) {
  if (isIsoDateString(startDate) && isIsoDateString(endDate)) {
    if (startDate <= endDate) {
      return { startDate, endDate };
    }

    return { startDate: endDate, endDate: startDate };
  }

  const currentMonth = monthDateRange(new Date());
  return {
    startDate: currentMonth.start,
    endDate: currentMonth.end,
  };
}

function buildMonthKeysBetween(startDate: string, endDate: string) {
  const start = parseUtcDate(startDate);
  const end = parseUtcDate(endDate);
  const months: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endCursor = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (cursor <= endCursor) {
    months.push(formatUtcDate(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
}

function buildAnalysisTrend(
  startDate: string,
  endDate: string,
  rows: Pick<ExpenseRow, "occurred_on" | "amount">[],
): AnalysisTrendItem[] {
  const totalDays = diffDaysInclusive(startDate, endDate);

  if (totalDays <= 62) {
    const totals = new Map<string, number>();
    for (const row of rows) {
      totals.set(row.occurred_on, (totals.get(row.occurred_on) ?? 0) + row.amount);
    }

    const items: AnalysisTrendItem[] = [];
    let cursor = startDate;
    while (cursor <= endDate) {
      items.push({
        bucket: cursor,
        label: formatDisplayDate(cursor),
        totalAmount: totals.get(cursor) ?? 0,
        granularity: "day",
      });
      cursor = shiftDateString(cursor, 1);
    }

    return items;
  }

  const totals = new Map<string, number>();
  for (const row of rows) {
    const monthKey = `${row.occurred_on.slice(0, 7)}-01`;
    totals.set(monthKey, (totals.get(monthKey) ?? 0) + row.amount);
  }

  return buildMonthKeysBetween(startDate, endDate).map((monthKey) => ({
    bucket: monthKey.slice(0, 7),
    label: formatMonthLabel(monthKey),
    totalAmount: totals.get(monthKey) ?? 0,
    granularity: "month",
  }));
}

function createEmptyAnalysisSnapshot(
  startDate: string,
  endDate: string,
  account: CurrentAccountSnapshot,
): AnalysisSnapshot {
  const previousEndDate = shiftDateString(startDate, -1);
  const previousStartDate = shiftDateString(startDate, -diffDaysInclusive(startDate, endDate));

  return {
    account,
    period: {
      startDate,
      endDate,
      label: formatAnalysisPeriodLabel(startDate, endDate),
    },
    totalAmount: 0,
    fixedAmount: 0,
    variableAmount: 0,
    categoryTotals: [],
    trend: buildAnalysisTrend(startDate, endDate, []),
    previousPeriodComparison: {
      previousStartDate,
      previousEndDate,
      previousTotalAmount: 0,
      differenceAmount: 0,
      changeRate: null,
    },
    budgetComparison: {
      totalBudgetAmount: null,
      differenceFromBudget: null,
      usageRate: null,
    },
    topExpenses: [],
    topMerchants: [],
    overBudgetCategories: [],
    increasedCategories: [],
  };
}

function createEmptyYearlySpendingTrendSnapshot(
  date: Date,
  account: CurrentAccountSnapshot
): YearlySpendingTrendSnapshot {
  const targetYear = String(date.getFullYear());

  return {
    account,
    targetYear,
    totalAmount: 0,
    items: Array.from({ length: 12 }, (_, index) => ({
      month: `${targetYear}-${String(index + 1).padStart(2, "0")}`,
      monthLabel: `${index + 1}月`,
      totalAmount: 0,
    })),
    availableYears: [{ value: targetYear, label: `${targetYear}年` }],
  };
}

function createEmptyHistorySnapshot(
  date: Date,
  account: CurrentAccountSnapshot
): ExpenseHistorySnapshot {
  const targetMonth = monthStartDateString(date).slice(0, 7);

  return {
    account,
    targetMonth,
    monthLabel: formatMonthLabel(`${targetMonth}-01`),
    totalAmount: 0,
    totalCount: 0,
    days: [],
    availableMonths: [{ value: targetMonth, label: formatMonthLabel(`${targetMonth}-01`) }]
  };
}

function createEmptyCategoryBreakdownSnapshot(
  date: Date,
  account: CurrentAccountSnapshot,
  selectedCategoryId: string | null,
  selectedSort: "date_desc" | "date_asc" | "amount_desc" | "amount_asc" = "date_desc"
): CategoryBreakdownSnapshot {
  const targetMonth = monthStartDateString(date).slice(0, 7);

  return {
    account,
    targetMonth,
    monthLabel: formatMonthLabel(`${targetMonth}-01`),
    totalAmount: 0,
    items: [],
    availableMonths: [{ value: targetMonth, label: formatMonthLabel(`${targetMonth}-01`) }],
    selectedCategoryId,
    selectedCategoryName: null,
    selectedSort,
    selectedExpenses: []
  };
}

const getCachedCategories = unstable_cache(
  async (): Promise<CategoryOption[]> => {
    try {
      const { url, anonKey } = getSupabaseConfig();
      const supabase = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error || !data || data.length === 0) {
        return INITIAL_CATEGORIES;
      }

      return mapCategoryOptions(data);
    } catch {
      return INITIAL_CATEGORIES;
    }
  },
  ["finance-categories"],
  { revalidate: 3600 }
);

function buildMonthlyBudgetOverviewFromRows(params: {
  date: Date;
  categories: CategoryOption[];
  budget: MonthlyBudgetRow | null;
  budgetCategories: MonthlyBudgetCategoryRow[];
  spentAmount: number;
}): MonthlyBudgetOverview {
  const { date, categories, budget, budgetCategories, spentAmount } = params;

  if (!budget) {
    return createEmptyBudgetOverview(date);
  }

  const targetMonth = monthStartDateString(date);
  const selectedCategoryIds = budgetCategories.map((item) => item.category_id);
  const selectedCategorySet = new Set(selectedCategoryIds);
  const selectedCategories = categories.filter((category) => selectedCategorySet.has(category.id));
  const monthlyBudget = budget.budget_amount;
  const remainingAmount = monthlyBudget - spentAmount;
  const usageRate = monthlyBudget > 0 ? spentAmount / monthlyBudget : spentAmount > 0 ? 1 : 0;

  return {
    targetMonth,
    monthLabel: formatMonthLabel(targetMonth),
    monthlyBudget,
    selectedCategoryIds,
    selectedCategories,
    spentAmount,
    remainingAmount,
    usageRate,
    isOverBudget: spentAmount > monthlyBudget,
    hasBudget: true,
    hasSelectedCategories: selectedCategoryIds.length > 0,
  };
}

export async function listCategories(): Promise<CategoryOption[]> {
  return getCachedCategories();
}

export async function getMonthlyBudgetOverview(date = new Date()): Promise<MonthlyBudgetOverview> {
  try {
    const accountContext = await getAuthenticatedAccountContext();

    if (!accountContext) {
      return createEmptyBudgetOverview(date);
    }

    const [supabase, categories] = await Promise.all([
      createServerSupabaseClient(),
      listCategories(),
    ]);
    const targetMonth = monthStartDateString(date);
    const { start, end } = monthDateRange(date);

    const { budget, categories: budgetCategories } = await ensureMonthlyBudgetRows(
      supabase,
      accountContext,
      targetMonth,
    );

    if (!budget) {
      return createEmptyBudgetOverview(date);
    }

    const selectedCategoryIds = (budgetCategories ?? []).map((item) => item.category_id);

    let spentAmount = 0;
    const spentQuery = supabase
      .from("expenses")
      .select("amount")
      .gte("occurred_on", start)
      .lte("occurred_on", end)
      .eq("account_id", accountContext.currentAccount.id);

    if (selectedCategoryIds.length > 0) {
      spentQuery.in("category_id", selectedCategoryIds);
    }

    const { data: spentRows, error: spentError } = await spentQuery;

    if (!spentError && spentRows) {
      spentAmount = spentRows.reduce((sum, row) => sum + row.amount, 0);
    }

    return buildMonthlyBudgetOverviewFromRows({
      date,
      categories,
      budget,
      budgetCategories,
      spentAmount,
    });
  } catch {
    return createEmptyBudgetOverview(date);
  }
}

export async function getBudgetTemplateSnapshot(
  date = new Date(),
): Promise<BudgetTemplateSnapshot> {
  const categories = await listCategories();
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
  const targetMonth = monthStartDateString(date);
  const previousMonthDate = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  const previousTargetMonth = monthStartDateString(previousMonthDate);

  try {
    const accountContext = await getAuthenticatedAccountContext();

    if (!accountContext) {
      return {
        targetMonth,
        monthLabel: formatMonthLabel(targetMonth),
        templateId: null,
        totalBudget: null,
        categoryBudgets: [],
        categories,
        tracksCategoryBudgets: false,
      };
    }

    const supabase = await createServerSupabaseClient();
    const [{ template, categories: templateCategories }, monthlyRows, previousMonthRows] = await Promise.all([
      getDefaultBudgetTemplateRows(supabase, accountContext),
      getMonthlyBudgetRows(supabase, accountContext, targetMonth),
      getMonthlyBudgetRows(supabase, accountContext, previousTargetMonth),
    ]);

    const sourceBudget = template?.total_budget ?? monthlyRows.budget?.budget_amount ?? null;
    const sourceCategoryRows =
      templateCategories.length > 0
        ? templateCategories
        : monthlyRows.categories.map((row) => ({
            id: row.id,
            template_id: template?.id ?? "",
            category_id: row.category_id,
            budget_amount: row.budget_amount,
            created_at: row.created_at,
            updated_at: row.updated_at,
          }));
    const previousBudgetMap = new Map(
      previousMonthRows.categories.map((row) => [row.category_id, row.budget_amount]),
    );

    return {
      targetMonth,
      monthLabel: formatMonthLabel(targetMonth),
      templateId: template?.id ?? null,
      totalBudget: sourceBudget,
      categoryBudgets: mapBudgetCategoryAllocations(sourceCategoryRows, categoryMap).map((item) => ({
        ...item,
        previousBudgetAmount: previousBudgetMap.get(item.categoryId) ?? null,
      })),
      categories,
      tracksCategoryBudgets: sourceCategoryRows.some((row) => row.budget_amount > 0),
    };
  } catch {
    return {
      targetMonth,
      monthLabel: formatMonthLabel(targetMonth),
      templateId: null,
      totalBudget: null,
      categoryBudgets: [],
      categories,
      tracksCategoryBudgets: false,
    };
  }
}

export async function getMonthlyBudgetDetailSnapshot(
  month?: string,
): Promise<MonthlyBudgetDetailSnapshot> {
  const targetDate = resolveMonthDate(month);

  try {
    const accountContext = await getAuthenticatedAccountContext();

    if (!accountContext) {
      return createFallbackBudgetDetailSnapshot(targetDate);
    }

    const [supabase, categories] = await Promise.all([
      createServerSupabaseClient(),
      listCategories(),
    ]);
    const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
    const targetMonth = monthStartDateString(targetDate);
    const { start, end } = monthDateRange(targetDate);
    const monthlyRows = await ensureMonthlyBudgetRows(supabase, accountContext, targetMonth);

    if (!monthlyRows.budget) {
      return {
        account: accountContext,
        targetMonth,
        monthLabel: formatMonthLabel(targetMonth),
        templateId: null,
        monthlyBudgetId: null,
        totalBudget: null,
        totalSpent: 0,
        totalRemaining: null,
        totalUsageRate: null,
        hasBudget: false,
        tracksSelectedCategories: false,
        categoryItems: [],
      };
    }

    const trackedCategoryIds = monthlyRows.categories
      .filter((row) => row.budget_amount > 0)
      .map((row) => row.category_id);
    const tracksSelectedCategories = trackedCategoryIds.length > 0;
    const expenseQuery = supabase
      .from("expenses")
      .select("category_id, amount")
      .eq("account_id", accountContext.currentAccount.id)
      .gte("occurred_on", start)
      .lte("occurred_on", end);

    if (tracksSelectedCategories) {
      expenseQuery.in("category_id", trackedCategoryIds);
    }

    const { data: expenseRows, error: expenseError } = await expenseQuery;

    if (expenseError) {
      return createFallbackBudgetDetailSnapshot(targetDate);
    }

    const spentByCategory = new Map<string, number>();
    for (const row of expenseRows ?? []) {
      spentByCategory.set(row.category_id, (spentByCategory.get(row.category_id) ?? 0) + row.amount);
    }

    const categoryIds = tracksSelectedCategories
      ? trackedCategoryIds
      : Array.from(
          new Set([
            ...monthlyRows.categories.map((row) => row.category_id),
            ...Array.from(spentByCategory.keys()),
          ]),
        );

    const budgetMap = new Map(
      monthlyRows.categories.map((row) => [row.category_id, row.budget_amount]),
    );

    const categoryItems: BudgetDetailCategoryItem[] = categoryIds
      .map((categoryId) => {
        const budgetAmount = budgetMap.get(categoryId) ?? 0;
        const spentAmount = spentByCategory.get(categoryId) ?? 0;
        return {
          categoryId,
          categoryName: categoryMap.get(categoryId) ?? "未設定カテゴリ",
          budgetAmount,
          spentAmount,
          remainingAmount: budgetAmount - spentAmount,
          usageRate: budgetAmount > 0 ? spentAmount / budgetAmount : null,
        };
      })
      .sort((left, right) => {
        if (left.budgetAmount === right.budgetAmount) {
          return right.spentAmount - left.spentAmount;
        }
        return right.budgetAmount - left.budgetAmount;
      });

    const totalSpent = (expenseRows ?? []).reduce((sum, row) => sum + row.amount, 0);
    const totalBudget = monthlyRows.budget.budget_amount;

    return {
      account: accountContext,
      targetMonth,
      monthLabel: formatMonthLabel(targetMonth),
      templateId: monthlyRows.budget.template_id,
      monthlyBudgetId: monthlyRows.budget.id,
      totalBudget,
      totalSpent,
      totalRemaining: totalBudget - totalSpent,
      totalUsageRate: totalBudget > 0 ? totalSpent / totalBudget : null,
      hasBudget: true,
      tracksSelectedCategories,
      categoryItems,
    };
  } catch {
    return createFallbackBudgetDetailSnapshot(targetDate);
  }
}

export async function listRecentExpenses(limit = 12): Promise<ExpenseListItem[]> {
  try {
    const accountContext = await getAuthenticatedAccountContext();

    if (!accountContext) {
      return [];
    }

    const [supabase, categories] = await Promise.all([
      createServerSupabaseClient(),
      listCategories(),
    ]);
    const categoryMap = new Map(categories.map((category) => [category.id, category.name]));

    const { data, error } = await supabase
      .from("expenses")
      .select(
        "id, title, amount, occurred_on, merchant_name, note, import_group_id, recurring_expense_id, category_id, source_type"
      )
      .eq("account_id", accountContext.currentAccount.id)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return mapExpenseRows(data, categoryMap);
  } catch {
    return [];
  }
}

export async function getExpensesPageSnapshot(limit = 50): Promise<ExpensesPageSnapshot> {
  try {
    const accountContext = await getAuthenticatedAccountContext();

    if (!accountContext) {
      return {
        account: createFallbackAccountSnapshot(),
        items: [],
        groups: [],
        totalCount: 0,
        totalAmount: 0,
      };
    }

    const [supabase, categories] = await Promise.all([
      createServerSupabaseClient(),
      listCategories(),
    ]);
    const categoryMap = new Map(categories.map((category) => [category.id, category.name]));

    const { data: recentRows, error: recentError } = await supabase
      .from("expenses")
      .select(
        "id, title, amount, occurred_on, merchant_name, note, import_group_id, recurring_expense_id, category_id, source_type"
      )
      .eq("account_id", accountContext.currentAccount.id)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (recentError) {
      return {
        account: accountContext,
        items: [],
        groups: [],
        totalCount: 0,
        totalAmount: 0
      };
    }

    const items = mapExpenseRows(recentRows ?? [], categoryMap);
    const groupMap = new Map<string, ExpenseImportGroupSummary>();

    for (const item of items) {
      const current = groupMap.get(item.importGroupId);

      if (current) {
        current.items.push(item);
        current.itemCount += 1;
        current.totalAmount += item.amount;
        continue;
      }

      groupMap.set(item.importGroupId, {
        importGroupId: item.importGroupId,
        sourceType: item.sourceType,
        recurringExpenseId: item.recurringExpenseId,
        occurredOn: item.occurredOn,
        merchantName: item.merchantName ?? item.title,
        itemCount: 1,
        totalAmount: item.amount,
        items: [item]
      });
    }

    const groups = Array.from(groupMap.values()).sort((left, right) => {
      if (left.occurredOn === right.occurredOn) {
        return right.items.length - left.items.length;
      }

      return left.occurredOn < right.occurredOn ? 1 : -1;
    });

    return {
      account: accountContext,
      items,
      groups,
      totalCount: items.length,
      totalAmount: items.reduce((sum, item) => sum + item.amount, 0)
    };
  } catch {
    return {
      account: createFallbackAccountSnapshot(),
      items: [],
      groups: [],
      totalCount: 0,
      totalAmount: 0
    };
  }
}

export async function getExpensesReportSnapshot(month?: string): Promise<ExpensesReportSnapshot> {
  try {
    const accountContext = await getAuthenticatedAccountContext();
    const supabase = await createServerSupabaseClient();
    const targetDate = resolveMonthDate(month);

    if (!accountContext) {
      return createEmptyReportSnapshot(targetDate, createFallbackAccountSnapshot());
    }

    const { start, end } = monthDateRange(targetDate);

    const [{ data: monthRows, error: monthError }, { data: allExpenseDates, error: allDatesError }] =
      await Promise.all([
        supabase
          .from("expenses")
          .select("occurred_on, amount")
          .eq("account_id", accountContext.currentAccount.id)
          .gte("occurred_on", start)
          .lte("occurred_on", end)
          .order("occurred_on", { ascending: true }),
        supabase
          .from("expenses")
          .select("occurred_on")
          .eq("account_id", accountContext.currentAccount.id)
          .order("occurred_on", { ascending: false })
      ]);

    if (monthError || allDatesError) {
      return createEmptyReportSnapshot(targetDate, accountContext);
    }

    return {
      account: accountContext,
      targetMonth: start.slice(0, 7),
      monthLabel: formatMonthLabel(start),
      totalAmount: (monthRows ?? []).reduce((sum, item) => sum + item.amount, 0),
      dailySpending: buildDailySpending(targetDate, monthRows ?? []),
      availableMonths: buildAvailableMonths(allExpenseDates ?? [], targetDate)
    };
  } catch {
    return createEmptyReportSnapshot(resolveMonthDate(month), createFallbackAccountSnapshot());
  }
}

export async function getMonthlySummarySnapshot(month?: string): Promise<MonthlySummarySnapshot> {
  try {
    const accountContext = await getAuthenticatedAccountContext();
    const targetDate = resolveMonthDate(month);

    if (!accountContext) {
      return createEmptyMonthlySummarySnapshot(targetDate, createFallbackAccountSnapshot());
    }

    const [supabase, categories] = await Promise.all([
      createServerSupabaseClient(),
      listCategories(),
    ]);
    const categoryMap = new Map(categories.map((category) => [category.id, category.name]));

    const previousMonthDate = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1);
    const { start, end } = monthDateRange(targetDate);
    const { start: previousStart, end: previousEnd } = monthDateRange(previousMonthDate);
    const monthlyRowsPromise = ensureMonthlyBudgetRows(supabase, accountContext, start);

    const [monthlyRows, monthResult, previousResult, allDatesResult] = await Promise.all([
      monthlyRowsPromise,
      supabase
        .from("expenses")
        .select("category_id, amount, recurring_expense_id")
        .eq("account_id", accountContext.currentAccount.id)
        .gte("occurred_on", start)
        .lte("occurred_on", end),
      supabase
        .from("expenses")
        .select("amount")
        .eq("account_id", accountContext.currentAccount.id)
        .gte("occurred_on", previousStart)
        .lte("occurred_on", previousEnd),
      supabase
        .from("expenses")
        .select("occurred_on")
        .eq("account_id", accountContext.currentAccount.id)
        .order("occurred_on", { ascending: false })
    ]);

    if (monthResult.error || previousResult.error || allDatesResult.error) {
      return createEmptyMonthlySummarySnapshot(targetDate, accountContext);
    }

    const monthRows = monthResult.data ?? [];
    const previousRows = previousResult.data ?? [];
    const allExpenseDates = allDatesResult.data ?? [];

    const totalAmount = monthRows.reduce((sum, row) => sum + row.amount, 0);
    const previousMonthAmount = previousRows.reduce((sum, row) => sum + row.amount, 0);
    const differenceFromPreviousMonth = totalAmount - previousMonthAmount;
    const fixedAmount = monthRows
      .filter((row) => row.recurring_expense_id != null)
      .reduce((sum, row) => sum + row.amount, 0);
    const variableAmount = totalAmount - fixedAmount;
    const trackedCategoryIds = monthlyRows.categories
      .filter((row) => row.budget_amount > 0)
      .map((row) => row.category_id);
    const trackedCategorySet = new Set(trackedCategoryIds);
    const spentAmountForBudget =
      trackedCategoryIds.length > 0
        ? monthRows
            .filter((row) => trackedCategorySet.has(row.category_id))
            .reduce((sum, row) => sum + row.amount, 0)
        : totalAmount;
    const budgetOverview = buildMonthlyBudgetOverviewFromRows({
      date: targetDate,
      categories,
      budget: monthlyRows.budget,
      budgetCategories: monthlyRows.categories,
      spentAmount: spentAmountForBudget,
    });

    const summaryMap = new Map<string, MonthlySummaryCategoryItem>();

    for (const row of monthRows) {
      const categoryId = row.category_id;
      const current = summaryMap.get(categoryId) ?? {
        categoryId,
        categoryName: categoryMap.get(categoryId) ?? "未設定カテゴリ",
        totalAmount: 0,
        shareRate: 0,
      };

      current.totalAmount += row.amount;
      summaryMap.set(categoryId, current);
    }

    const topCategories = Array.from(summaryMap.values())
      .sort((left, right) => right.totalAmount - left.totalAmount)
      .slice(0, 5)
      .map((item) => ({
        ...item,
        shareRate: totalAmount > 0 ? item.totalAmount / totalAmount : 0,
      }));

    return {
      account: accountContext,
      targetMonth: start.slice(0, 7),
      monthLabel: formatMonthLabel(start),
      totalAmount,
      previousMonthAmount,
      differenceFromPreviousMonth,
      budgetAmount: budgetOverview.monthlyBudget,
      differenceFromBudget:
        budgetOverview.monthlyBudget != null
          ? budgetOverview.monthlyBudget - totalAmount
          : null,
      usageRate: budgetOverview.usageRate,
      fixedAmount,
      variableAmount,
      topCategories,
      availableMonths: buildAvailableMonths(allExpenseDates, targetDate),
    };
  } catch {
    return createEmptyMonthlySummarySnapshot(resolveMonthDate(month), createFallbackAccountSnapshot());
  }
}

type AnalysisSnapshotOptions = {
  startDate?: string;
  endDate?: string;
};

export async function getAnalysisSnapshot(
  options: AnalysisSnapshotOptions = {},
): Promise<AnalysisSnapshot> {
  const { startDate, endDate } = resolveAnalysisDateRange(options.startDate, options.endDate);

  try {
    const accountContext = await getAuthenticatedAccountContext();

    if (!accountContext) {
      return createEmptyAnalysisSnapshot(startDate, endDate, createFallbackAccountSnapshot());
    }

    const supabase = await createServerSupabaseClient();
    const categories = await listCategories();
    const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
    const periodDays = diffDaysInclusive(startDate, endDate);
    const previousEndDate = shiftDateString(startDate, -1);
    const previousStartDate = shiftDateString(startDate, -periodDays);
    const budgetMonths = buildMonthKeysBetween(startDate, endDate);

    const [currentResult, previousResult, monthlyBudgetRows] = await Promise.all([
      supabase
        .from("expenses")
        .select("id, title, amount, occurred_on, merchant_name, category_id, recurring_expense_id")
        .eq("account_id", accountContext.currentAccount.id)
        .gte("occurred_on", startDate)
        .lte("occurred_on", endDate)
        .order("occurred_on", { ascending: true })
        .order("created_at", { ascending: false }),
      supabase
        .from("expenses")
        .select("amount, category_id")
        .eq("account_id", accountContext.currentAccount.id)
        .gte("occurred_on", previousStartDate)
        .lte("occurred_on", previousEndDate),
      Promise.all(
        budgetMonths.map((targetMonth) =>
          getMonthlyBudgetRows(supabase, accountContext, targetMonth),
        ),
      ),
    ]);

    if (currentResult.error || previousResult.error) {
      return createEmptyAnalysisSnapshot(startDate, endDate, accountContext);
    }

    const currentRows = currentResult.data ?? [];
    const previousRows = previousResult.data ?? [];
    const totalAmount = currentRows.reduce((sum, row) => sum + row.amount, 0);
    const previousTotalAmount = previousRows.reduce((sum, row) => sum + row.amount, 0);
    const fixedAmount = currentRows
      .filter((row) => row.recurring_expense_id != null)
      .reduce((sum, row) => sum + row.amount, 0);
    const variableAmount = totalAmount - fixedAmount;

    const previousCategoryMap = new Map<string, number>();
    for (const row of previousRows) {
      previousCategoryMap.set(row.category_id, (previousCategoryMap.get(row.category_id) ?? 0) + row.amount);
    }

    let totalBudgetAmount: number | null = 0;
    const categoryBudgetMap = new Map<string, number>();
    for (const monthRows of monthlyBudgetRows) {
      if (!monthRows.budget) {
        continue;
      }

      totalBudgetAmount = (totalBudgetAmount ?? 0) + monthRows.budget.budget_amount;
      for (const row of monthRows.categories) {
        categoryBudgetMap.set(row.category_id, (categoryBudgetMap.get(row.category_id) ?? 0) + row.budget_amount);
      }
    }

    if (totalBudgetAmount === 0) {
      totalBudgetAmount = null;
    }

    const categoryTotalsMap = new Map<string, AnalysisCategoryTotalItem>();
    for (const row of currentRows) {
      const categoryId = row.category_id;
      const current = categoryTotalsMap.get(categoryId) ?? {
        categoryId,
        categoryName: categoryMap.get(categoryId) ?? "未設定カテゴリ",
        totalAmount: 0,
        shareRate: 0,
        differenceFromPreviousPeriod: null,
        budgetAmount: categoryBudgetMap.get(categoryId) ?? null,
        differenceFromBudget: null,
        usageRate: null,
        isOverBudget: false,
      };

      current.totalAmount += row.amount;
      categoryTotalsMap.set(categoryId, current);
    }

    const categoryTotals = Array.from(categoryTotalsMap.values())
      .map((item) => {
        const previousAmount = previousCategoryMap.get(item.categoryId) ?? 0;
        const budgetAmount = item.budgetAmount;
        const differenceFromBudget =
          budgetAmount != null ? budgetAmount - item.totalAmount : null;
        const usageRate = budgetAmount && budgetAmount > 0 ? item.totalAmount / budgetAmount : null;

        return {
          ...item,
          shareRate: totalAmount > 0 ? item.totalAmount / totalAmount : 0,
          differenceFromPreviousPeriod: item.totalAmount - previousAmount,
          budgetAmount,
          differenceFromBudget,
          usageRate,
          isOverBudget: budgetAmount != null && budgetAmount > 0 && item.totalAmount > budgetAmount,
        };
      })
      .sort((left, right) => right.totalAmount - left.totalAmount);

    const topExpenses: AnalysisTopExpenseItem[] = currentRows
      .slice()
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 5)
      .map((row) => ({
        expenseId: row.id,
        title: row.title,
        amount: row.amount,
        occurredOn: row.occurred_on,
        merchantName: row.merchant_name,
        categoryName: categoryMap.get(row.category_id) ?? "未設定カテゴリ",
        recurringExpenseId: row.recurring_expense_id,
      }));

    const merchantMap = new Map<string, AnalysisTopMerchantItem>();
    for (const row of currentRows) {
      const merchantName = row.merchant_name?.trim();
      if (!merchantName) {
        continue;
      }

      const current = merchantMap.get(merchantName) ?? {
        merchantName,
        totalAmount: 0,
        count: 0,
      };
      current.totalAmount += row.amount;
      current.count += 1;
      merchantMap.set(merchantName, current);
    }

    const topMerchants = Array.from(merchantMap.values())
      .sort((left, right) => {
        if (left.totalAmount === right.totalAmount) {
          return right.count - left.count;
        }
        return right.totalAmount - left.totalAmount;
      })
      .slice(0, 5);

    const budgetComparison: AnalysisBudgetComparison = {
      totalBudgetAmount,
      differenceFromBudget: totalBudgetAmount != null ? totalBudgetAmount - totalAmount : null,
      usageRate: totalBudgetAmount && totalBudgetAmount > 0 ? totalAmount / totalBudgetAmount : null,
    };

    const previousPeriodComparison: AnalysisPeriodComparison = {
      previousStartDate,
      previousEndDate,
      previousTotalAmount,
      differenceAmount: totalAmount - previousTotalAmount,
      changeRate: previousTotalAmount > 0 ? (totalAmount - previousTotalAmount) / previousTotalAmount : null,
    };

    return {
      account: accountContext,
      period: {
        startDate,
        endDate,
        label: formatAnalysisPeriodLabel(startDate, endDate),
      },
      totalAmount,
      fixedAmount,
      variableAmount,
      categoryTotals,
      trend: buildAnalysisTrend(startDate, endDate, currentRows),
      previousPeriodComparison,
      budgetComparison,
      topExpenses,
      topMerchants,
      overBudgetCategories: categoryTotals.filter((item) => item.isOverBudget).slice(0, 5),
      increasedCategories: categoryTotals
        .filter((item) => (item.differenceFromPreviousPeriod ?? 0) > 0)
        .sort(
          (left, right) =>
            (right.differenceFromPreviousPeriod ?? 0) - (left.differenceFromPreviousPeriod ?? 0),
        )
        .slice(0, 5),
    };
  } catch {
    return createEmptyAnalysisSnapshot(startDate, endDate, createFallbackAccountSnapshot());
  }
}

export async function getYearlySpendingTrendSnapshot(
  year?: string
): Promise<YearlySpendingTrendSnapshot> {
  const targetYear = year && /^\d{4}$/.test(year) ? year : String(new Date().getFullYear());
  const targetDate = new Date(`${targetYear}-01-01T00:00:00`);

  try {
    const accountContext = await getAuthenticatedAccountContext();

    if (!accountContext) {
      return createEmptyYearlySpendingTrendSnapshot(targetDate, createFallbackAccountSnapshot());
    }

    const supabase = await createServerSupabaseClient();
    const start = `${targetYear}-01-01`;
    const end = `${targetYear}-12-31`;

    const [{ data: yearRows, error: yearError }, { data: allDates, error: allDatesError }] =
      await Promise.all([
        supabase
          .from("expenses")
          .select("occurred_on, amount")
          .eq("account_id", accountContext.currentAccount.id)
          .gte("occurred_on", start)
          .lte("occurred_on", end),
        supabase
          .from("expenses")
          .select("occurred_on")
          .eq("account_id", accountContext.currentAccount.id)
          .order("occurred_on", { ascending: false }),
      ]);

    if (yearError || allDatesError) {
      return createEmptyYearlySpendingTrendSnapshot(targetDate, accountContext);
    }

    const monthlyTotals = new Map<string, number>();

    for (const row of yearRows ?? []) {
      const monthKey = row.occurred_on.slice(0, 7);
      monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) ?? 0) + row.amount);
    }

    const items: YearlySpendingTrendItem[] = Array.from({ length: 12 }, (_, index) => {
      const month = `${targetYear}-${String(index + 1).padStart(2, "0")}`;
      return {
        month,
        monthLabel: `${index + 1}月`,
        totalAmount: monthlyTotals.get(month) ?? 0,
      };
    });

    const years = new Set<string>([targetYear]);
    for (const row of allDates ?? []) {
      years.add(row.occurred_on.slice(0, 4));
    }

    return {
      account: accountContext,
      targetYear,
      totalAmount: items.reduce((sum, item) => sum + item.totalAmount, 0),
      items,
      availableYears: Array.from(years)
        .sort((left, right) => (left < right ? 1 : -1))
        .map((value) => ({ value, label: `${value}年` })),
    };
  } catch {
    return createEmptyYearlySpendingTrendSnapshot(
      targetDate,
      createFallbackAccountSnapshot()
    );
  }
}

export async function getExpenseHistorySnapshot(month?: string): Promise<ExpenseHistorySnapshot> {
  try {
    const accountContext = await getAuthenticatedAccountContext();
    const supabase = await createServerSupabaseClient();
    const targetDate = resolveMonthDate(month);

    if (!accountContext) {
      return createEmptyHistorySnapshot(targetDate, createFallbackAccountSnapshot());
    }

    const { start, end } = monthDateRange(targetDate);

    const [{ data: monthRows, error: monthError }, { data: allExpenseDates, error: allDatesError }] =
      await Promise.all([
        supabase
          .from("expenses")
          .select("occurred_on, amount")
          .eq("account_id", accountContext.currentAccount.id)
          .gte("occurred_on", start)
          .lte("occurred_on", end)
          .order("occurred_on", { ascending: false }),
        supabase
          .from("expenses")
          .select("occurred_on")
          .eq("account_id", accountContext.currentAccount.id)
          .order("occurred_on", { ascending: false })
      ]);

    if (monthError || allDatesError) {
      return createEmptyHistorySnapshot(targetDate, accountContext);
    }

    const dayMap = new Map<string, ExpenseHistoryDaySummary>();

    for (const row of monthRows ?? []) {
      const current = dayMap.get(row.occurred_on) ?? {
        date: row.occurred_on,
        totalAmount: 0,
        count: 0
      };
      current.totalAmount += row.amount;
      current.count += 1;
      dayMap.set(row.occurred_on, current);
    }

    const days = Array.from(dayMap.values()).sort((left, right) =>
      left.date < right.date ? 1 : -1
    );

    return {
      account: accountContext,
      targetMonth: start.slice(0, 7),
      monthLabel: formatMonthLabel(start),
      totalAmount: (monthRows ?? []).reduce((sum, item) => sum + item.amount, 0),
      totalCount: (monthRows ?? []).length,
      days,
      availableMonths: buildAvailableMonths(allExpenseDates ?? [], targetDate)
    };
  } catch {
    return createEmptyHistorySnapshot(resolveMonthDate(month), createFallbackAccountSnapshot());
  }
}

export async function getCategoryBreakdownSnapshot(
  month?: string,
  selectedCategoryId: string | null = null,
  sort: "date_desc" | "date_asc" | "amount_desc" | "amount_asc" = "date_desc"
): Promise<CategoryBreakdownSnapshot> {
  try {
    const accountContext = await getAuthenticatedAccountContext();
    const supabase = await createServerSupabaseClient();
    const categories = await listCategories();
    const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
    const targetDate = resolveMonthDate(month);

    if (!accountContext) {
      return createEmptyCategoryBreakdownSnapshot(
        targetDate,
        createFallbackAccountSnapshot(),
        selectedCategoryId,
        sort
      );
    }

    const { start, end } = monthDateRange(targetDate);

    const [{ data: monthRows, error: monthError }, { data: allExpenseDates, error: allDatesError }] =
      await Promise.all([
        supabase
          .from("expenses")
          .select("category_id, amount")
          .eq("account_id", accountContext.currentAccount.id)
          .gte("occurred_on", start)
          .lte("occurred_on", end),
        supabase
          .from("expenses")
          .select("occurred_on")
          .eq("account_id", accountContext.currentAccount.id)
          .order("occurred_on", { ascending: false })
      ]);

    if (monthError || allDatesError) {
      return createEmptyCategoryBreakdownSnapshot(
        targetDate,
        accountContext,
        selectedCategoryId,
        sort
      );
    }

    const summaryMap = new Map<string, CategorySummaryItem>();

    for (const row of monthRows ?? []) {
      const categoryId = row.category_id;
      const categoryName = categoryMap.get(categoryId) ?? "未設定カテゴリ";
      const current = summaryMap.get(categoryId) ?? {
        categoryId,
        categoryName,
        total: 0,
        count: 0
      };
      current.total += row.amount;
      current.count += 1;
      summaryMap.set(categoryId, current);
    }

    let selectedExpenses: ExpenseListItem[] = [];

    if (selectedCategoryId) {
      const { data: selectedRows, error: selectedError } = await supabase
        .from("expenses")
        .select(
          "id, title, amount, occurred_on, merchant_name, note, import_group_id, recurring_expense_id, category_id, source_type"
        )
        .eq("account_id", accountContext.currentAccount.id)
        .eq("category_id", selectedCategoryId)
        .gte("occurred_on", start)
        .lte("occurred_on", end)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false });

      if (!selectedError && selectedRows) {
        selectedExpenses = mapExpenseRows(selectedRows, categoryMap).sort((left, right) => {
          if (sort === "amount_desc") {
            if (left.amount === right.amount) {
              return left.occurredOn < right.occurredOn ? 1 : -1;
            }
            return right.amount - left.amount;
          }

          if (sort === "amount_asc") {
            if (left.amount === right.amount) {
              return left.occurredOn < right.occurredOn ? -1 : 1;
            }
            return left.amount - right.amount;
          }

          if (sort === "date_asc") {
            if (left.occurredOn === right.occurredOn) {
              return left.amount - right.amount;
            }

            return left.occurredOn < right.occurredOn ? -1 : 1;
          }

          if (left.occurredOn === right.occurredOn) {
            return right.amount - left.amount;
          }

          return left.occurredOn < right.occurredOn ? 1 : -1;
        });
      }
    }

    return {
      account: accountContext,
      targetMonth: start.slice(0, 7),
      monthLabel: formatMonthLabel(start),
      totalAmount: (monthRows ?? []).reduce((sum, item) => sum + item.amount, 0),
      items: Array.from(summaryMap.values()).sort((left, right) => right.total - left.total),
      availableMonths: buildAvailableMonths(allExpenseDates ?? [], targetDate),
      selectedCategoryId,
      selectedCategoryName: selectedCategoryId
        ? categoryMap.get(selectedCategoryId) ?? "未設定カテゴリ"
        : null,
      selectedSort: sort,
      selectedExpenses
    };
  } catch {
    return createEmptyCategoryBreakdownSnapshot(
      resolveMonthDate(month),
      createFallbackAccountSnapshot(),
      selectedCategoryId,
      sort
    );
  }
}

export async function getDailyExpensesSnapshot(date: string): Promise<DailyExpensesSnapshot | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  try {
    const accountContext = await getAuthenticatedAccountContext();

    if (!accountContext) {
      return null;
    }

    const supabase = await createServerSupabaseClient();
    const categories = await listCategories();
    const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
    const { data, error } = await supabase
      .from("expenses")
      .select(
        "id, title, amount, occurred_on, merchant_name, note, import_group_id, recurring_expense_id, category_id, source_type"
      )
      .eq("account_id", accountContext.currentAccount.id)
      .eq("occurred_on", date)
      .order("created_at", { ascending: false });

    if (error) {
      return null;
    }

    const items = mapExpenseRows(data ?? [], categoryMap);
    const summaryMap = new Map<string, { categoryId: string | null; total: number; count: number }>();

    for (const item of items) {
      const key = item.categoryId ?? "uncategorized";
      const current = summaryMap.get(key) ?? {
        categoryId: item.categoryId,
        total: 0,
        count: 0
      };
      current.total += item.amount;
      current.count += 1;
      summaryMap.set(key, current);
    }

    return {
      account: accountContext,
      date,
      totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
      items,
      categories,
      categorySummary: Array.from(summaryMap.values())
        .map((value) => ({
          categoryId: value.categoryId,
          categoryName:
            value.categoryId && categoryMap.get(value.categoryId)
              ? categoryMap.get(value.categoryId)!
              : "未設定カテゴリ",
          total: value.total,
          count: value.count
        }))
        .sort((left, right) => right.total - left.total)
    };
  } catch {
    return null;
  }
}

export async function getPendingImportsPageSnapshot(): Promise<PendingImportsPageSnapshot> {
  try {
    const accountContext = await getAuthenticatedAccountContext();

    if (!accountContext) {
      return {
        account: createFallbackAccountSnapshot(),
        groups: [],
        totalCount: 0,
        recurringExpenseCandidates: [],
      };
    }

    const supabase = await createServerSupabaseClient();
    const currentMonth = new Date();

    const [
      { data: groups, error: groupsError },
      { data: drafts, error: draftsError },
      { data: recurringExpenseRows, error: recurringExpensesError },
      { data: existingRecurringRows, error: existingRecurringRowsError },
      { data: hiddenRecurringRows, error: hiddenRecurringRowsError },
      categories,
    ] = await Promise.all([
        supabase
          .from("import_groups")
          .select("id, source_type, created_at, occurred_on, title")
          .eq("account_id", accountContext.currentAccount.id)
          .eq("status", "draft")
          .order("created_at", { ascending: false }),
        supabase
          .from("expense_drafts")
          .select("id, import_group_id, merchant_name, title, created_at, line_index")
          .eq("account_id", accountContext.currentAccount.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("recurring_expenses")
          .select(
            "id, user_id, account_id, category_id, name, amount, schedule_day, schedule_time, memo, is_active, start_date, end_date, last_applied_at, next_scheduled_at, created_at, updated_at",
          )
          .eq("account_id", accountContext.currentAccount.id)
          .eq("is_active", true)
          .order("schedule_day", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("expenses")
          .select("recurring_expense_id, occurred_on")
          .eq("account_id", accountContext.currentAccount.id)
          .gte(
            "occurred_on",
            new Date(Date.UTC(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
              .toISOString()
              .slice(0, 10),
          )
          .lte(
            "occurred_on",
            new Date(Date.UTC(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0))
              .toISOString()
              .slice(0, 10),
          )
          .not("recurring_expense_id", "is", null),
        supabase
          .from("recurring_expense_candidate_hides")
          .select("recurring_expense_id, target_month")
          .eq("account_id", accountContext.currentAccount.id)
          .gte(
            "target_month",
            new Date(Date.UTC(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
              .toISOString()
              .slice(0, 10),
          )
          .lte("target_month", monthStartDateString(currentMonth)),
        listCategories(),
      ]);

    if (groupsError || draftsError) {
      return {
        account: accountContext,
        groups: [],
        totalCount: 0,
        recurringExpenseCandidates: [],
      };
    }

    const pendingGroups = buildPendingImportGroups(groups ?? [], drafts ?? []);
    const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
    const existingRecurringKeys = new Set(
      (existingRecurringRows ?? [])
        .filter(
          (
            row,
          ): row is {
            recurring_expense_id: string;
            occurred_on: string;
          } =>
            typeof row.recurring_expense_id === "string" &&
            typeof row.occurred_on === "string",
        )
        .map((row) => `${row.recurring_expense_id}:${row.occurred_on}`),
    );
    const hiddenRecurringKeys = new Set(
      (hiddenRecurringRowsError ? [] : hiddenRecurringRows ?? [])
        .filter(
          (
            row,
          ): row is {
            recurring_expense_id: string;
            target_month: string;
          } =>
            typeof row.recurring_expense_id === "string" &&
            typeof row.target_month === "string",
        )
        .map((row) => `${row.recurring_expense_id}:${row.target_month}`),
    );
    const recurringExpenseCandidates: RecurringExpenseCandidateItem[] =
      recurringExpensesError || existingRecurringRowsError || !recurringExpenseRows
        ? []
        : recurringExpenseRows
            .map((item) => {
              const occurrence = getUpcomingOccurrenceWithinDays(item, 7);
              if (!occurrence) {
                return null;
              }
              const targetMonth = monthStartDateString(new Date(`${occurrence.occurredOn}T00:00:00`));
              if (hiddenRecurringKeys.has(`${item.id}:${targetMonth}`)) {
                return null;
              }

              return {
                recurringExpenseId: item.id,
                name: item.name,
                amount: item.amount,
                categoryId: item.category_id,
                categoryName: categoryMap.get(item.category_id) ?? "譛ｪ險ｭ螳壹き繝・ざ繝ｪ",
                scheduleDay: item.schedule_day,
                scheduleTime: item.schedule_time.slice(0, 5),
                occurredOn: occurrence.occurredOn,
                targetMonth,
                memo: item.memo,
                isAlreadyAdded: existingRecurringKeys.has(`${item.id}:${occurrence.occurredOn}`),
              };
            })
            .filter((item): item is RecurringExpenseCandidateItem => item != null);

    return {
      account: accountContext,
      groups: pendingGroups,
      totalCount: pendingGroups.length,
      recurringExpenseCandidates,
    };
  } catch {
    return {
      account: createFallbackAccountSnapshot(),
      groups: [],
      totalCount: 0,
      recurringExpenseCandidates: [],
    };
  }
}

export async function getDraftReviewSnapshot(
  importGroupId: string
): Promise<DraftReviewSnapshot | null> {
  try {
    const accountContext = await getAuthenticatedAccountContext();

    if (!accountContext) {
      return null;
    }

    const supabase = await createServerSupabaseClient();
    const categories = await listCategories();
    const categoryMap = new Map(categories.map((category) => [category.id, category.name]));

    const [{ data: importGroup, error: importGroupError }, { data: drafts, error: draftsError }] =
      await Promise.all([
        supabase
          .from("import_groups")
          .select("id, source_type, status, title, occurred_on, metadata")
          .eq("account_id", accountContext.currentAccount.id)
          .eq("id", importGroupId)
          .single(),
        supabase
          .from("expense_drafts")
          .select(
            "id, import_group_id, line_index, title, amount, note, merchant_name, occurred_on, suggested_category_id, source_type, needs_review"
          )
          .eq("account_id", accountContext.currentAccount.id)
          .eq("import_group_id", importGroupId)
          .order("line_index", { ascending: true })
          .order("created_at", { ascending: true })
      ]);

    if (importGroupError || draftsError || !importGroup) {
      return null;
    }

    const items: DraftReviewItem[] = (drafts ?? []).map((draft) => ({
      id: draft.id,
      importGroupId: draft.import_group_id,
      lineIndex: draft.line_index,
      title: draft.title,
      amount: draft.amount,
      note: draft.note,
      merchantName: draft.merchant_name,
      occurredOn: draft.occurred_on,
      categoryId: draft.suggested_category_id,
      categoryName: draft.suggested_category_id
        ? categoryMap.get(draft.suggested_category_id) ?? null
        : null,
      sourceType: draft.source_type,
      needsReview:
        draft.needs_review ||
        !draft.title.trim() ||
        draft.amount == null ||
        draft.amount <= 0 ||
        !draft.suggested_category_id
    }));

    return {
      account: accountContext,
      importGroupId: importGroup.id,
      sourceType: importGroup.source_type,
      status: importGroup.status,
      title: importGroup.title,
      occurredOn: importGroup.occurred_on,
      draftCount: items.length,
      needsReviewCount: items.filter((item) => item.needsReview).length,
      ocrDebug: mapOcrDebugInfo(importGroup.metadata),
      items,
      categories
    };
  } catch {
    return null;
  }
}

export async function getDashboardSnapshot(date = new Date()): Promise<DashboardSnapshot> {
  try {
    const accountContext = await getAuthenticatedAccountContext();
    const supabase = await createServerSupabaseClient();
    const categories = await listCategories();
    const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
    const { start, end } = monthDateRange(date);

    if (!accountContext) {
      return {
        account: createFallbackAccountSnapshot(),
        budget: createEmptyBudgetOverview(date),
        monthlyTotal: 0,
        categorySummary: [],
      };
    }

    const [{ data: monthExpenses, error: expenseError }, budget] = await Promise.all([
      supabase
        .from("expenses")
        .select(
          "id, title, amount, occurred_on, merchant_name, note, import_group_id, recurring_expense_id, category_id, source_type"
        )
        .eq("account_id", accountContext.currentAccount.id)
        .gte("occurred_on", start)
        .lte("occurred_on", end)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false }),
      getMonthlyBudgetOverview(date)
    ]);

    if (expenseError) {
      return {
        account: accountContext,
        budget,
        monthlyTotal: 0,
        categorySummary: []
      };
    }

    const expenses = mapExpenseRows(monthExpenses ?? [], categoryMap);
    const summaryMap = new Map<string, CategorySummaryItem>();

    for (const expense of expenses) {
      const key = expense.categoryId ?? "uncategorized";
      const current = summaryMap.get(key) ?? {
        categoryId: expense.categoryId ?? key,
        categoryName: expense.categoryName,
        total: 0,
        count: 0
      };
      current.total += expense.amount;
      current.count += 1;
      summaryMap.set(key, current);
    }

    return {
      account: accountContext,
      budget,
      monthlyTotal: expenses.reduce((sum, expense) => sum + expense.amount, 0),
      categorySummary: Array.from(summaryMap.values())
        .sort((left, right) => right.total - left.total)
        .slice(0, 3)
    };
  } catch {
    return {
      account: createFallbackAccountSnapshot(),
      budget: createEmptyBudgetOverview(date),
      monthlyTotal: 0,
      categorySummary: []
    };
  }
}
