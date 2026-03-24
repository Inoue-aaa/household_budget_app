export type FieldName = "occurredOn" | "title" | "amount" | "categoryId";

export type ManualExpenseFormValues = {
  occurredOn: string;
  merchantName: string;
  title: string;
  amount: string;
  categoryId: string;
  note: string;
};

export type ManualExpenseFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<FieldName, string>>;
  values: ManualExpenseFormValues;
};

export const initialManualExpenseFormState: ManualExpenseFormState = {
  status: "idle",
  values: {
    occurredOn: "",
    merchantName: "",
    title: "",
    amount: "",
    categoryId: "",
    note: ""
  }
};
