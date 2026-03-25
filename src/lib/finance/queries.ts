import { INITIAL_CATEGORIES } from "@/lib/finance/categories";
import type {
  CategoryRow,
  ExpenseDraftRow,
  ExpenseRow,
  ImportGroupRow
} from "@/lib/finance/db-types";
import type {
  CategorySummaryItem,
  CategoryBreakdownSnapshot,
  CategoryOption,
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
  MonthlyBudgetOverview,
  OcrDebugInfo,
  PendingImportGroupSummary,
  PendingImportsPageSnapshot,
  ReportMonthOption
} from "@/lib/finance/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatMonthLabel, monthDateRange, monthStartDateString } from "@/lib/utils/format";

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

function createEmptyReportSnapshot(date: Date): ExpensesReportSnapshot {
  const targetMonth = monthStartDateString(date).slice(0, 7);

  return {
    targetMonth,
    monthLabel: formatMonthLabel(`${targetMonth}-01`),
    totalAmount: 0,
    dailySpending: [],
    availableMonths: [{ value: targetMonth, label: formatMonthLabel(`${targetMonth}-01`) }]
  };
}

function createEmptyHistorySnapshot(date: Date): ExpenseHistorySnapshot {
  const targetMonth = monthStartDateString(date).slice(0, 7);

  return {
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
  selectedCategoryId: string | null,
  selectedSort: "date_desc" | "date_asc" | "amount_desc" | "amount_asc" = "date_desc"
): CategoryBreakdownSnapshot {
  const targetMonth = monthStartDateString(date).slice(0, 7);

  return {
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

export async function listCategories(): Promise<CategoryOption[]> {
  try {
    const supabase = await createServerSupabaseClient();
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
}

export async function getMonthlyBudgetOverview(date = new Date()): Promise<MonthlyBudgetOverview> {
  try {
    const supabase = await createServerSupabaseClient();
    const categories = await listCategories();
    const targetMonth = monthStartDateString(date);
    const { start, end } = monthDateRange(date);

    const { data: budget, error: budgetError } = await supabase
      .from("monthly_budgets")
      .select("id, target_month, budget_amount")
      .eq("target_month", targetMonth)
      .maybeSingle();

    if (budgetError || !budget) {
      return createEmptyBudgetOverview(date);
    }

    const { data: budgetCategories, error: budgetCategoriesError } = await supabase
      .from("monthly_budget_categories")
      .select("category_id")
      .eq("monthly_budget_id", budget.id)
      .order("created_at", { ascending: true });

    if (budgetCategoriesError) {
      return createEmptyBudgetOverview(date);
    }

    const selectedCategoryIds = (budgetCategories ?? []).map((item) => item.category_id);
    const selectedCategorySet = new Set(selectedCategoryIds);
    const selectedCategories = categories.filter((category) => selectedCategorySet.has(category.id));

    let spentAmount = 0;

    if (selectedCategoryIds.length > 0) {
      const { data: spentRows, error: spentError } = await supabase
        .from("expenses")
        .select("amount")
        .gte("occurred_on", start)
        .lte("occurred_on", end)
        .in("category_id", selectedCategoryIds);

      if (!spentError && spentRows) {
        spentAmount = spentRows.reduce((sum, row) => sum + row.amount, 0);
      }
    }

    const monthlyBudget = budget.budget_amount;
    const remainingAmount = monthlyBudget - spentAmount;
    const usageRate =
      monthlyBudget > 0 ? spentAmount / monthlyBudget : spentAmount > 0 ? 1 : 0;

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
      hasSelectedCategories: selectedCategoryIds.length > 0
    };
  } catch {
    return createEmptyBudgetOverview(date);
  }
}

export async function listRecentExpenses(limit = 12): Promise<ExpenseListItem[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const categories = await listCategories();
    const categoryMap = new Map(categories.map((category) => [category.id, category.name]));

    const { data, error } = await supabase
      .from("expenses")
      .select(
        "id, title, amount, occurred_on, merchant_name, note, import_group_id, category_id, source_type"
      )
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
    const supabase = await createServerSupabaseClient();
    const categories = await listCategories();
    const categoryMap = new Map(categories.map((category) => [category.id, category.name]));

    const { data: recentRows, error: recentError } = await supabase
      .from("expenses")
      .select(
        "id, title, amount, occurred_on, merchant_name, note, import_group_id, category_id, source_type"
      )
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (recentError) {
      return {
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
      items,
      groups,
      totalCount: items.length,
      totalAmount: items.reduce((sum, item) => sum + item.amount, 0)
    };
  } catch {
    return {
      items: [],
      groups: [],
      totalCount: 0,
      totalAmount: 0
    };
  }
}

export async function getExpensesReportSnapshot(month?: string): Promise<ExpensesReportSnapshot> {
  try {
    const supabase = await createServerSupabaseClient();
    const targetDate = resolveMonthDate(month);
    const { start, end } = monthDateRange(targetDate);

    const [{ data: monthRows, error: monthError }, { data: allExpenseDates, error: allDatesError }] =
      await Promise.all([
        supabase
          .from("expenses")
          .select("occurred_on, amount")
          .gte("occurred_on", start)
          .lte("occurred_on", end)
          .order("occurred_on", { ascending: true }),
        supabase.from("expenses").select("occurred_on").order("occurred_on", { ascending: false })
      ]);

    if (monthError || allDatesError) {
      return createEmptyReportSnapshot(targetDate);
    }

    return {
      targetMonth: start.slice(0, 7),
      monthLabel: formatMonthLabel(start),
      totalAmount: (monthRows ?? []).reduce((sum, item) => sum + item.amount, 0),
      dailySpending: buildDailySpending(targetDate, monthRows ?? []),
      availableMonths: buildAvailableMonths(allExpenseDates ?? [], targetDate)
    };
  } catch {
    return createEmptyReportSnapshot(resolveMonthDate(month));
  }
}

export async function getExpenseHistorySnapshot(month?: string): Promise<ExpenseHistorySnapshot> {
  try {
    const supabase = await createServerSupabaseClient();
    const targetDate = resolveMonthDate(month);
    const { start, end } = monthDateRange(targetDate);

    const [{ data: monthRows, error: monthError }, { data: allExpenseDates, error: allDatesError }] =
      await Promise.all([
        supabase
          .from("expenses")
          .select("occurred_on, amount")
          .gte("occurred_on", start)
          .lte("occurred_on", end)
          .order("occurred_on", { ascending: false }),
        supabase.from("expenses").select("occurred_on").order("occurred_on", { ascending: false })
      ]);

    if (monthError || allDatesError) {
      return createEmptyHistorySnapshot(targetDate);
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
      targetMonth: start.slice(0, 7),
      monthLabel: formatMonthLabel(start),
      totalAmount: (monthRows ?? []).reduce((sum, item) => sum + item.amount, 0),
      totalCount: (monthRows ?? []).length,
      days,
      availableMonths: buildAvailableMonths(allExpenseDates ?? [], targetDate)
    };
  } catch {
    return createEmptyHistorySnapshot(resolveMonthDate(month));
  }
}

export async function getCategoryBreakdownSnapshot(
  month?: string,
  selectedCategoryId: string | null = null,
  sort: "date_desc" | "date_asc" | "amount_desc" | "amount_asc" = "date_desc"
): Promise<CategoryBreakdownSnapshot> {
  try {
    const supabase = await createServerSupabaseClient();
    const categories = await listCategories();
    const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
    const targetDate = resolveMonthDate(month);
    const { start, end } = monthDateRange(targetDate);

    const [{ data: monthRows, error: monthError }, { data: allExpenseDates, error: allDatesError }] =
      await Promise.all([
        supabase
          .from("expenses")
          .select("category_id, amount")
          .gte("occurred_on", start)
          .lte("occurred_on", end),
        supabase.from("expenses").select("occurred_on").order("occurred_on", { ascending: false })
      ]);

    if (monthError || allDatesError) {
      return createEmptyCategoryBreakdownSnapshot(targetDate, selectedCategoryId, sort);
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
          "id, title, amount, occurred_on, merchant_name, note, import_group_id, category_id, source_type"
        )
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
    return createEmptyCategoryBreakdownSnapshot(resolveMonthDate(month), selectedCategoryId, sort);
  }
}

export async function getDailyExpensesSnapshot(date: string): Promise<DailyExpensesSnapshot | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  try {
    const supabase = await createServerSupabaseClient();
    const categories = await listCategories();
    const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
    const { data, error } = await supabase
      .from("expenses")
      .select(
        "id, title, amount, occurred_on, merchant_name, note, import_group_id, category_id, source_type"
      )
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
    const supabase = await createServerSupabaseClient();

    const [{ data: groups, error: groupsError }, { data: drafts, error: draftsError }] =
      await Promise.all([
        supabase
          .from("import_groups")
          .select("id, source_type, created_at, occurred_on, title")
          .eq("status", "draft")
          .order("created_at", { ascending: false }),
        supabase
          .from("expense_drafts")
          .select("id, import_group_id, merchant_name, title, created_at, line_index")
          .order("created_at", { ascending: false })
      ]);

    if (groupsError || draftsError) {
      return {
        groups: [],
        totalCount: 0
      };
    }

    const pendingGroups = buildPendingImportGroups(groups ?? [], drafts ?? []);

    return {
      groups: pendingGroups,
      totalCount: pendingGroups.length
    };
  } catch {
    return {
      groups: [],
      totalCount: 0
    };
  }
}

export async function getDraftReviewSnapshot(
  importGroupId: string
): Promise<DraftReviewSnapshot | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const categories = await listCategories();
    const categoryMap = new Map(categories.map((category) => [category.id, category.name]));

    const [{ data: importGroup, error: importGroupError }, { data: drafts, error: draftsError }] =
      await Promise.all([
        supabase
          .from("import_groups")
          .select("id, source_type, status, title, occurred_on, metadata")
          .eq("id", importGroupId)
          .single(),
        supabase
          .from("expense_drafts")
          .select(
            "id, import_group_id, line_index, title, amount, note, merchant_name, occurred_on, suggested_category_id, source_type, needs_review"
          )
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
    const supabase = await createServerSupabaseClient();
    const categories = await listCategories();
    const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
    const { start, end } = monthDateRange(date);

    const [{ data: monthExpenses, error: expenseError }, budget] = await Promise.all([
      supabase
        .from("expenses")
        .select(
          "id, title, amount, occurred_on, merchant_name, note, import_group_id, category_id, source_type"
        )
        .gte("occurred_on", start)
        .lte("occurred_on", end)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false }),
      getMonthlyBudgetOverview(date)
    ]);

    if (expenseError) {
      return {
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
      budget,
      monthlyTotal: expenses.reduce((sum, expense) => sum + expense.amount, 0),
      categorySummary: Array.from(summaryMap.values())
        .sort((left, right) => right.total - left.total)
        .slice(0, 3)
    };
  } catch {
    return {
      budget: createEmptyBudgetOverview(date),
      monthlyTotal: 0,
      categorySummary: []
    };
  }
}
