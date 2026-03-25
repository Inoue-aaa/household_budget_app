"use client";

import { deleteDraftRowAction } from "@/features/import-review/actions";
import type { CategoryOption, DraftReviewItem } from "@/lib/finance/types";

export type DraftReviewEditableValues = {
  occurredOn: string;
  merchantName: string;
  title: string;
  amount: string;
  categoryId: string;
  note: string;
};

type DraftReviewRowFormProps = {
  importGroupId: string;
  item: DraftReviewItem;
  categories: CategoryOption[];
  merchantLabel: string;
  values: DraftReviewEditableValues;
  onChange: (field: keyof DraftReviewEditableValues, value: string) => void;
};

export function DraftReviewRowForm({
  importGroupId,
  item,
  categories,
  merchantLabel,
  values,
  onChange
}: DraftReviewRowFormProps) {
  return (
    <div className="field-stack review-row-form">
      <div className="review-inline-grid review-inline-grid-wide">
        <div className="field">
          <label htmlFor={`occurredOn-${item.id}`}>日付</label>
          <input
            className="review-form-control"
            data-testid={`review-row-${item.id}-occurred-on`}
            id={`occurredOn-${item.id}`}
            name={`occurredOn-${item.id}`}
            onChange={(event) => onChange("occurredOn", event.target.value)}
            required
            type="date"
            value={values.occurredOn}
          />
        </div>

        <div className="field">
          <label htmlFor={`merchantName-${item.id}`}>{merchantLabel}</label>
          <input
            className="review-form-control"
            data-testid={`review-row-${item.id}-merchant-name`}
            id={`merchantName-${item.id}`}
            maxLength={120}
            name={`merchantName-${item.id}`}
            onChange={(event) => onChange("merchantName", event.target.value)}
            type="text"
            value={values.merchantName}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor={`title-${item.id}`}>内容</label>
        <input
          className="review-form-control"
          data-testid={`review-row-${item.id}-title`}
          id={`title-${item.id}`}
          name={`title-${item.id}`}
          onChange={(event) => onChange("title", event.target.value)}
          required
          type="text"
          value={values.title}
        />
      </div>

      <div className="review-inline-grid review-inline-grid-wide">
        <div className="field">
          <label htmlFor={`amount-${item.id}`}>金額</label>
          <input
            className="review-form-control"
            data-testid={`review-row-${item.id}-amount`}
            id={`amount-${item.id}`}
            inputMode="numeric"
            min="1"
            name={`amount-${item.id}`}
            onChange={(event) => onChange("amount", event.target.value)}
            required
            step="1"
            type="number"
            value={values.amount}
          />
        </div>

        <div className="field">
          <label htmlFor={`category-${item.id}`}>カテゴリ</label>
          <select
            className="review-form-control"
            data-testid={`review-row-${item.id}-category-id`}
            id={`category-${item.id}`}
            name={`category-${item.id}`}
            onChange={(event) => onChange("categoryId", event.target.value)}
            required
            value={values.categoryId}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor={`note-${item.id}`}>メモ</label>
        <textarea
          className="review-form-control review-form-textarea"
          data-testid={`review-row-${item.id}-note`}
          id={`note-${item.id}`}
          name={`note-${item.id}`}
          onChange={(event) => onChange("note", event.target.value)}
          value={values.note}
        />
      </div>

      <div className="review-row-actions review-row-actions-single">
        <form action={deleteDraftRowAction}>
          <input name="importGroupId" type="hidden" value={importGroupId} />
          <input name="draftId" type="hidden" value={item.id} />
          <button
            className="button button-secondary compact-button review-row-action-secondary"
            data-testid={`review-row-${item.id}-delete`}
            type="submit"
          >
            削除
          </button>
        </form>
      </div>
    </div>
  );
}
