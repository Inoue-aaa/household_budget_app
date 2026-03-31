export type SourceType = "receipt" | "manual" | "credit_screenshot";
export type ImportGroupStatus = "draft" | "confirmed" | "discarded";
export type RuleSource = "manual_entry" | "user_confirmation" | "admin_seed";
export type HouseholdAccountSlug = "atsuki" | "sara" | "shared";
export type HouseholdAccountColorKey = "blue" | "pink" | "blend";

export type HouseholdAccountOption = {
  id: string;
  slug: HouseholdAccountSlug;
  name: string;
  colorKey: HouseholdAccountColorKey;
  sortOrder: number;
};

export type CurrentAccountSnapshot = {
  currentAccount: HouseholdAccountOption;
  accounts: HouseholdAccountOption[];
};

export type CategoryOption = {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  isActive?: boolean;
};

export type ExpenseListItem = {
  id: string;
  title: string;
  amount: number;
  occurredOn: string;
  merchantName: string | null;
  note: string | null;
  importGroupId: string;
  recurringExpenseId?: string | null;
  categoryId: string | null;
  categoryName: string;
  sourceType: SourceType;
};

export type CategorySummaryItem = {
  categoryId: string;
  categoryName: string;
  total: number;
  count: number;
};

export type MonthlyBudgetOverview = {
  targetMonth: string;
  monthLabel: string;
  monthlyBudget: number | null;
  selectedCategoryIds: string[];
  selectedCategories: CategoryOption[];
  spentAmount: number;
  remainingAmount: number | null;
  usageRate: number | null;
  isOverBudget: boolean;
  hasBudget: boolean;
  hasSelectedCategories: boolean;
};

export type BudgetCategoryAllocation = {
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  previousBudgetAmount?: number | null;
};

export type BudgetTemplateSnapshot = {
  targetMonth: string;
  monthLabel: string;
  templateId: string | null;
  totalBudget: number | null;
  categoryBudgets: BudgetCategoryAllocation[];
  categories: CategoryOption[];
  tracksCategoryBudgets: boolean;
};

export type BudgetDetailCategoryItem = {
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  usageRate: number | null;
  isOverBudget?: boolean;
};

export type MonthlyBudgetDetailSnapshot = {
  account: CurrentAccountSnapshot;
  targetMonth: string;
  monthLabel: string;
  templateId: string | null;
  monthlyBudgetId: string | null;
  totalBudget: number | null;
  totalSpent: number;
  totalRemaining: number | null;
  totalUsageRate: number | null;
  hasBudget: boolean;
  tracksSelectedCategories: boolean;
  categoryItems: BudgetDetailCategoryItem[];
};

export type DailySpendingItem = {
  date: string;
  day: number;
  amount: number;
};

export type ReportMonthOption = {
  value: string;
  label: string;
};

export type DashboardSnapshot = {
  account: CurrentAccountSnapshot;
  budget: MonthlyBudgetOverview;
  monthlyTotal: number;
  categorySummary: CategorySummaryItem[];
};

export type ExpensesPageSnapshot = {
  account: CurrentAccountSnapshot;
  items: ExpenseListItem[];
  groups: ExpenseImportGroupSummary[];
  totalCount: number;
  totalAmount: number;
};

export type ExpensesReportSnapshot = {
  account: CurrentAccountSnapshot;
  targetMonth: string;
  monthLabel: string;
  totalAmount: number;
  dailySpending: DailySpendingItem[];
  availableMonths: ReportMonthOption[];
};

export type MonthlySummaryCategoryItem = {
  categoryId: string;
  categoryName: string;
  totalAmount: number;
  shareRate: number;
};

export type MonthlySummarySnapshot = {
  account: CurrentAccountSnapshot;
  targetMonth: string;
  monthLabel: string;
  totalAmount: number;
  previousMonthAmount: number;
  differenceFromPreviousMonth: number;
  budgetAmount: number | null;
  differenceFromBudget: number | null;
  usageRate: number | null;
  fixedAmount: number;
  variableAmount: number;
  topCategories: MonthlySummaryCategoryItem[];
  availableMonths: ReportMonthOption[];
};

export type YearlySpendingTrendItem = {
  month: string;
  monthLabel: string;
  totalAmount: number;
};

export type YearlySpendingTrendSnapshot = {
  account: CurrentAccountSnapshot;
  targetYear: string;
  totalAmount: number;
  items: YearlySpendingTrendItem[];
  availableYears: { value: string; label: string }[];
};

export type DailyExpenseCategorySummary = {
  categoryId: string | null;
  categoryName: string;
  total: number;
  count: number;
};

export type DailyExpensesSnapshot = {
  account: CurrentAccountSnapshot;
  date: string;
  totalAmount: number;
  items: ExpenseListItem[];
  categorySummary: DailyExpenseCategorySummary[];
  categories: CategoryOption[];
};

export type ExpenseImportGroupSummary = {
  importGroupId: string;
  sourceType: SourceType;
  occurredOn: string;
  merchantName: string | null;
  itemCount: number;
  totalAmount: number;
  items: ExpenseListItem[];
};

export type ExpenseHistoryDaySummary = {
  date: string;
  totalAmount: number;
  count: number;
};

export type ExpenseHistorySnapshot = {
  account: CurrentAccountSnapshot;
  targetMonth: string;
  monthLabel: string;
  totalAmount: number;
  totalCount: number;
  days: ExpenseHistoryDaySummary[];
  availableMonths: ReportMonthOption[];
};

export type CategoryBreakdownSnapshot = {
  account: CurrentAccountSnapshot;
  targetMonth: string;
  monthLabel: string;
  totalAmount: number;
  items: CategorySummaryItem[];
  availableMonths: ReportMonthOption[];
  selectedCategoryId: string | null;
  selectedCategoryName: string | null;
  selectedSort: "date_desc" | "date_asc" | "amount_desc" | "amount_asc";
  selectedExpenses: ExpenseListItem[];
};

export type PendingImportGroupSummary = {
  importGroupId: string;
  sourceType: SourceType;
  createdAt: string;
  occurredOn: string | null;
  representativeLabel: string;
  draftCount: number;
};

export type PendingImportsPageSnapshot = {
  account: CurrentAccountSnapshot;
  groups: PendingImportGroupSummary[];
  totalCount: number;
  recurringExpenseCandidates: RecurringExpenseCandidateItem[];
};

export type RecurringExpenseCandidateItem = {
  recurringExpenseId: string;
  name: string;
  amount: number;
  categoryId: string;
  categoryName: string;
  scheduleDay: number;
  scheduleTime: string;
  occurredOn: string;
  memo: string | null;
  isAlreadyAdded: boolean;
};

export type RecurringExpenseListItem = {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  categoryName: string;
  scheduleDay: number;
  scheduleTime: string;
  memo: string | null;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  lastAppliedAt: string | null;
  nextScheduledAt: string | null;
};

export type RecurringExpenseLogResult =
  | "applied"
  | "skipped"
  | "inactive"
  | "already_applied"
  | "out_of_range";

export type RecurringExpenseLogListItem = {
  id: string;
  recurringExpenseId: string;
  recurringExpenseName: string;
  executedAt: string;
  targetMonth: string;
  resultType: RecurringExpenseLogResult;
  amount: number | null;
  reason: string | null;
};

export type RecurringExpensesPageSnapshot = {
  account: CurrentAccountSnapshot;
  items: RecurringExpenseListItem[];
  logs: RecurringExpenseLogListItem[];
  totalCount: number;
  activeCount: number;
};

export type OcrDebugInfo = {
  requestedProviderMode: "dummy" | "real" | "ollama_local";
  providerMode: "dummy" | "real" | "ollama_local";
  providerName: string | null;
  fallbackUsed: boolean;
  errorCode: string | null;
};

export type DraftReviewItem = {
  id: string;
  importGroupId: string;
  lineIndex: number;
  title: string;
  amount: number | null;
  note: string | null;
  merchantName: string | null;
  occurredOn: string | null;
  categoryId: string | null;
  categoryName: string | null;
  sourceType: SourceType;
  needsReview: boolean;
};

export type DraftReviewSnapshot = {
  account: CurrentAccountSnapshot;
  importGroupId: string;
  sourceType: SourceType;
  status: ImportGroupStatus;
  title: string | null;
  occurredOn: string | null;
  draftCount: number;
  needsReviewCount: number;
  ocrDebug: OcrDebugInfo | null;
  items: DraftReviewItem[];
  categories: CategoryOption[];
};
