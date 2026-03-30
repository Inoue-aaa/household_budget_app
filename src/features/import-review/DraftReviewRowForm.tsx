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

function normalizeReviewDateInput(value: string) {
  const normalized = value.replace(/[./]/g, "-").replace(/[^\d-]/g, "").slice(0, 10);
  const match = normalized.match(/^(\d{4})-(\d{0,2})-?(\d{0,2})$/);

  if (!match) {
    return normalized;
  }

  const [, year, month, day] = match;
  if (!month) {
    return year;
  }

  if (!day) {
    return `${year}-${month}`;
  }

  return `${year}-${month}-${day}`;
}

export function DraftReviewRowForm({
  importGroupId,
  item,
  categories,
  merchantLabel,
  values,
  onChange,
}: DraftReviewRowFormProps) {
  return (
    <div className="field-stack review-row-form">
      <div className="field review-field review-date-field">
        <label htmlFor={`occurredOn-${item.id}`}>日付</label>
        <input
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="review-form-control review-date-control"
          data-testid={`review-row-${item.id}-occurred-on`}
          enterKeyHint="next"
          id={`occurredOn-${item.id}`}
          inputMode="numeric"
          maxLength={10}
          name={`occurredOn-${item.id}`}
          onChange={(event) => onChange("occurredOn", normalizeReviewDateInput(event.target.value))}
          pattern="\d{4}-\d{2}-\d{2}"
          placeholder="2026-03-25"
          required
          spellCheck={false}
          type="text"
          value={values.occurredOn}
        />
      </div>

      <div className="review-inline-grid review-inline-grid-wide">
        <div className="field review-field">
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

        <div className="field review-field">
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
      </div>

      <div className="review-inline-grid review-inline-grid-compact">
        <div className="field review-field">
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

        <div className="field review-field">
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

      <div className="field review-field">
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
