export type MonthlyBudgetFieldName = "budgetAmount" | "categoryBudgets";

export type MonthlyBudgetCategoryValue = {
  categoryId: string;
  amount: string;
};

export type MonthlyBudgetFormValues = {
  targetMonth: string;
  budgetAmount: string;
  usesCategoryBudgets: string;
  applyToFuture: string;
  categoryBudgets: MonthlyBudgetCategoryValue[];
};

export type MonthlyBudgetFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<MonthlyBudgetFieldName, string>>;
  values: MonthlyBudgetFormValues;
};

export function createInitialMonthlyBudgetFormState(
  values: MonthlyBudgetFormValues,
): MonthlyBudgetFormState {
  return {
    status: "idle",
    values,
  };
}
