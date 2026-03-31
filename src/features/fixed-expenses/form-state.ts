export type FixedExpenseFieldName =
  | "name"
  | "amount"
  | "categoryId"
  | "scheduleDay"
  | "scheduleTime";

export type FixedExpenseFormValues = {
  name: string;
  amount: string;
  categoryId: string;
  scheduleDay: string;
  scheduleTime: string;
  memo: string;
  isActive: string;
};

export type FixedExpenseFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<FixedExpenseFieldName, string>>;
  values: FixedExpenseFormValues;
};

export const initialFixedExpenseFormState: FixedExpenseFormState = {
  status: "idle",
  values: {
    name: "",
    amount: "",
    categoryId: "",
    scheduleDay: "1",
    scheduleTime: "09:00",
    memo: "",
    isActive: "true",
  },
};
