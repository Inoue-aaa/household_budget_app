export type MonthlyBudgetFieldName = "budgetAmount";

export type MonthlyBudgetFormValues = {
  targetMonth: string;
  budgetAmount: string;
  categoryIds: string[];
};

export type MonthlyBudgetFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<MonthlyBudgetFieldName, string>>;
  values: MonthlyBudgetFormValues;
};

export function createInitialMonthlyBudgetFormState(
  values: MonthlyBudgetFormValues
): MonthlyBudgetFormState {
  return {
    status: "idle",
    values
  };
}
