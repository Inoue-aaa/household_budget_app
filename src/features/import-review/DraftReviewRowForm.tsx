"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SubmitButton } from "@/components/SubmitButton";
import { saveDraftRowAction } from "@/features/import-review/actions";
import {
  createInitialReviewDraftFormState,
  type ReviewDraftFormValues
} from "@/features/import-review/form-state";
import type { CategoryOption, DraftReviewItem, SourceType } from "@/lib/finance/types";

type DraftReviewRowFormProps = {
  importGroupId: string;
  item: DraftReviewItem;
  categories: CategoryOption[];
  sourceType: SourceType;
  merchantLabel: string;
  merchantHint: string;
  titleHint: string;
};

export function DraftReviewRowForm({
  importGroupId,
  item,
  categories,
  sourceType,
  merchantLabel,
  merchantHint,
  titleHint
}: DraftReviewRowFormProps) {
  const router = useRouter();
  const initialValues: ReviewDraftFormValues = {
    importGroupId,
    draftId: item.id,
    occurredOn: item.occurredOn ?? "",
    merchantName: item.merchantName ?? "",
    title: item.title,
    amount: item.amount == null ? "" : String(item.amount),
    categoryId: item.categoryId ?? categories[0]?.id ?? "",
    note: item.note ?? ""
  };
  const [state, formAction] = useActionState(
    saveDraftRowAction,
    createInitialReviewDraftFormState(initialValues)
  );

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  const values = state.values;

  return (
    <form action={formAction} className="field-stack">
      <input name="importGroupId" type="hidden" value={importGroupId} />
      <input name="draftId" type="hidden" value={item.id} />

      <div className="review-inline-grid">
        <div className="field">
          <label htmlFor={`occurredOn-${item.id}`}>日付</label>
          <input
            aria-invalid={Boolean(state.fieldErrors?.occurredOn)}
            data-testid={`review-row-${item.id}-occurred-on`}
            defaultValue={values.occurredOn}
            id={`occurredOn-${item.id}`}
            name="occurredOn"
            required
            type="date"
          />
          {state.fieldErrors?.occurredOn ? (
            <p className="error-text">{state.fieldErrors.occurredOn}</p>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor={`merchantName-${item.id}`}>{merchantLabel}</label>
          <input
            aria-invalid={Boolean(state.fieldErrors?.merchantName)}
            data-testid={`review-row-${item.id}-merchant-name`}
            defaultValue={values.merchantName}
            id={`merchantName-${item.id}`}
            maxLength={120}
            name="merchantName"
            type="text"
          />
          <p className="field-hint">{merchantHint}</p>
          {state.fieldErrors?.merchantName ? (
            <p className="error-text">{state.fieldErrors.merchantName}</p>
          ) : null}
        </div>
      </div>

      <div className="field">
        <label htmlFor={`title-${item.id}`}>内容</label>
        <input
          aria-invalid={Boolean(state.fieldErrors?.title)}
          data-testid={`review-row-${item.id}-title`}
          defaultValue={values.title}
          id={`title-${item.id}`}
          name="title"
          required
          type="text"
        />
        <p className="field-hint">{titleHint}</p>
        {state.fieldErrors?.title ? <p className="error-text">{state.fieldErrors.title}</p> : null}
      </div>

      <div className="review-inline-grid">
        <div className="field">
          <label htmlFor={`amount-${item.id}`}>金額</label>
          <input
            aria-invalid={Boolean(state.fieldErrors?.amount)}
            data-testid={`review-row-${item.id}-amount`}
            defaultValue={values.amount}
            id={`amount-${item.id}`}
            inputMode="numeric"
            min="1"
            name="amount"
            required
            step="1"
            type="number"
          />
          {state.fieldErrors?.amount ? <p className="error-text">{state.fieldErrors.amount}</p> : null}
        </div>

        <div className="field">
          <label htmlFor={`category-${item.id}`}>カテゴリ</label>
          <select
            aria-invalid={Boolean(state.fieldErrors?.categoryId)}
            data-testid={`review-row-${item.id}-category-id`}
            defaultValue={values.categoryId}
            id={`category-${item.id}`}
            name="categoryId"
            required
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {state.fieldErrors?.categoryId ? (
            <p className="error-text">{state.fieldErrors.categoryId}</p>
          ) : null}
        </div>
      </div>

      <div className="field">
        <label htmlFor={`note-${item.id}`}>メモ</label>
        <textarea
          aria-invalid={Boolean(state.fieldErrors?.note)}
          data-testid={`review-row-${item.id}-note`}
          defaultValue={values.note}
          id={`note-${item.id}`}
          name="note"
        />
        {state.fieldErrors?.note ? <p className="error-text">{state.fieldErrors.note}</p> : null}
      </div>

      {state.status !== "idle" && state.message ? (
        <p className={state.status === "success" ? "success-text" : "error-text"}>{state.message}</p>
      ) : null}

      <div className="review-row-actions">
        <SubmitButton
          className="button compact-button"
          pendingLabel="保存中..."
          testId={`review-row-${item.id}-save`}
        >
          この行を保存
        </SubmitButton>
        <span className="caption">
          {sourceType === "credit_screenshot"
            ? "利用先と日付を整えてから保存できます。"
            : "店舗名と日付も必要に応じて修正できます。"}
        </span>
      </div>
    </form>
  );
}
