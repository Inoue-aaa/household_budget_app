export type ReviewDraftFieldName =
  | "occurredOn"
  | "merchantName"
  | "title"
  | "amount"
  | "categoryId"
  | "note";

export type ReviewDraftFormValues = {
  importGroupId: string;
  draftId: string;
  occurredOn: string;
  merchantName: string;
  title: string;
  amount: string;
  categoryId: string;
  note: string;
};

export type ReviewDraftFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<ReviewDraftFieldName, string>>;
  values: ReviewDraftFormValues;
};

export function createInitialReviewDraftFormState(
  values: ReviewDraftFormValues
): ReviewDraftFormState {
  return {
    status: "idle",
    values
  };
}
