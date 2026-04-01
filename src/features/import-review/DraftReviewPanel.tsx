"use client";

import { useMemo, useState } from "react";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { SubmitButton } from "@/components/SubmitButton";
import {
  addDraftRowAction,
  confirmDraftsAction,
  discardImportGroupAction
} from "@/features/import-review/actions";
import {
  DraftReviewRowForm,
  type DraftReviewEditableValues
} from "@/features/import-review/DraftReviewRowForm";
import type { DraftReviewSnapshot, SourceType } from "@/lib/finance/types";
import { formatDisplayDate, formatSourceLabel } from "@/lib/utils/format";

type DraftReviewPanelProps = {
  snapshot: DraftReviewSnapshot;
};

type EditableDraftItem = {
  id: string;
  values: DraftReviewEditableValues;
  baseAmount: string;
  taxRate: 0 | 8 | 10;
};

function normalizeEditableOccurredOn(value: string | null) {
  if (!value) {
    return "";
  }

  const normalized = value.trim().replace(/[./]/g, "-");
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (!match) {
    return normalized;
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function merchantFieldLabel(sourceType: SourceType) {
  return sourceType === "credit_screenshot" ? "利用先" : "店舗名";
}

function createEditableItems(snapshot: DraftReviewSnapshot): EditableDraftItem[] {
  return snapshot.items.map((item) => {
    const amount = item.amount == null ? "" : String(item.amount);
    return {
      id: item.id,
      baseAmount: amount,
      taxRate: 0,
      values: {
        occurredOn: normalizeEditableOccurredOn(item.occurredOn),
        merchantName: item.merchantName ?? "",
        title: item.title ?? "",
        amount,
        categoryId: item.categoryId ?? snapshot.categories[0]?.id ?? "",
        note: item.note ?? ""
      }
    };
  });
}

export function DraftReviewPanel({ snapshot }: DraftReviewPanelProps) {
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [editableItems, setEditableItems] = useState<EditableDraftItem[]>(() =>
    createEditableItems(snapshot)
  );
  const merchantLabel = merchantFieldLabel(snapshot.sourceType);

  const reviewedIdSet = useMemo(() => new Set(reviewedIds), [reviewedIds]);
  const remainingItems = useMemo(
    () => snapshot.items.filter((item) => !reviewedIdSet.has(item.id)),
    [reviewedIdSet, snapshot.items]
  );

  const canConfirm = snapshot.items.length > 0 && remainingItems.length === 0;

  return (
    <div className="page-stack review-page review-page-wide">
      <section className="surface review-summary review-surface review-surface-wide">
        <div className="review-summary-header">
          <div>
            <p className="eyebrow">Review</p>
            <h1 className="screen-title">確認画面</h1>
            <p className="screen-description review-copy">
              必要な項目を整えてから、各明細を確認済みにしてください。
            </p>
          </div>
          <span className="pill pill-accent">{formatSourceLabel(snapshot.sourceType)}</span>
        </div>

        <div className="review-summary-grid">
          <div className="review-summary-card">
            <span className="stat-label">確認対象</span>
            <strong className="stat-value">{snapshot.draftCount}件</strong>
          </div>
          <div className="review-summary-card">
            <span className="stat-label">未確認</span>
            <strong className="stat-value">{remainingItems.length}件</strong>
          </div>
        </div>

        <p className="section-copy review-copy">
          取り込み: {snapshot.title ?? "未設定"}
          {snapshot.occurredOn ? ` ・ ${formatDisplayDate(snapshot.occurredOn)}` : ""}
        </p>
      </section>

      <section className="surface section-card review-surface review-surface-tight review-surface-wide">
        <h2 className="section-title">未確認の明細</h2>
        {remainingItems.length === 0 ? (
          <p className="section-copy review-copy">
            すべての明細が確認済みです。このまま保存して確定できます。
          </p>
        ) : (
          <div className="attention-item attention-item-compact">
            <p className="section-copy review-copy">
              未確認の明細が {remainingItems.length} 件あります。リストから順にチェックしてから、まとめて保存してください。
            </p>
          </div>
        )}
      </section>

      <section className="surface section-card review-surface review-surface-tight review-surface-wide">
        <div className="review-section-header">
          <div>
            <h2 className="section-title">明細一覧</h2>
            <p className="section-copy review-copy">
              必要な項目を整えてから、各明細を確認済みにしてください。
            </p>
          </div>
        </div>

        <div style={{ height: 12 }} />

        {snapshot.items.length === 0 ? (
          <div className="empty-state">
            <p className="section-title">確認対象の明細がありません</p>
            <p className="section-copy review-copy">新規追加して、必要な明細をここから作成できます。</p>
          </div>
        ) : (
          <div className="review-list">
            {snapshot.items.map((item) => {
              const isReviewed = reviewedIdSet.has(item.id);
              const editableItem = editableItems.find((entry) => entry.id === item.id);

              if (!editableItem) {
                return null;
              }

              return (
                <article
                  className={`review-row-card ${!isReviewed ? "review-row-card-attention" : ""} ${isReviewed ? "review-row-card-reviewed" : ""}`}
                  data-testid={`review-row-${item.id}`}
                  key={item.id}
                >
                  <div className="review-row-top">
                    <div>
                      <p className="list-title">明細 {item.lineIndex + 1}</p>
                      <p className="list-meta">
                        {editableItem.values.merchantName ? `${editableItem.values.merchantName} ・ ` : ""}
                        {editableItem.values.occurredOn
                          ? formatDisplayDate(editableItem.values.occurredOn)
                          : "日付未設定"}
                      </p>
                    </div>

                    <div className="review-row-top-right">
                      <button
                        aria-pressed={isReviewed}
                        className={`review-check-toggle ${!isReviewed ? "review-check-toggle-attention" : ""} ${isReviewed ? "review-check-toggle-active" : ""}`}
                        onClick={() => {
                          setReviewedIds((current) =>
                            current.includes(item.id)
                              ? current.filter((id) => id !== item.id)
                              : [...current, item.id]
                          );
                        }}
                        type="button"
                      >
                        <span aria-hidden="true" className="review-check-box">
                          {isReviewed ? "✓" : ""}
                        </span>
                        <span>{isReviewed ? "確認済み" : "確認が必要"}</span>
                      </button>
                    </div>
                  </div>

                  <DraftReviewRowForm
                    baseAmount={editableItem.baseAmount}
                    categories={snapshot.categories}
                    importGroupId={snapshot.importGroupId}
                    item={item}
                    merchantLabel={merchantLabel}
                    onChange={(field, value) => {
                      setEditableItems((current) =>
                        current.map((entry) => {
                          if (entry.id !== item.id) return entry;
                          // When user manually edits amount, reset base amount and tax rate
                          if (field === "amount") {
                            return {
                              ...entry,
                              baseAmount: value,
                              taxRate: 0,
                              values: { ...entry.values, [field]: value }
                            };
                          }
                          return { ...entry, values: { ...entry.values, [field]: value } };
                        })
                      );
                    }}
                    onTaxRateChange={(rate) => {
                      setEditableItems((current) =>
                        current.map((entry) => {
                          if (entry.id !== item.id) return entry;
                          const newAmount =
                            rate === 0
                              ? entry.baseAmount
                              : String(Math.floor(Number(entry.baseAmount) * (1 + rate / 100)));
                          return {
                            ...entry,
                            taxRate: rate,
                            values: { ...entry.values, amount: newAmount }
                          };
                        })
                      );
                    }}
                    taxRate={editableItem.taxRate}
                    values={editableItem.values}
                  />
                </article>
              );
            })}
          </div>
        )}

        <div className="review-add-row-footer">
          <form action={addDraftRowAction}>
            <input name="importGroupId" type="hidden" value={snapshot.importGroupId} />
            <button className="button button-secondary review-add-row-button" type="submit">
              新規追加
            </button>
          </form>
        </div>
      </section>

      <section className="surface section-card review-surface review-surface-wide">
        <h2 className="section-title">保存して確定</h2>
        <p className="section-copy review-copy">
          {canConfirm
            ? "すべて確認済みです。まとめて保存して、支出一覧へ反映できます。"
            : `未確認が ${remainingItems.length} 件あります。すべて確認済みにしてから保存してください。`}
        </p>
        <div style={{ height: 14 }} />
        {snapshot.items.length === 0 ? (
          <p className="section-copy review-copy">
            確定できる明細がありません。必要に応じて明細を追加してください。
          </p>
        ) : (
          <form action={confirmDraftsAction}>
            <input name="importGroupId" type="hidden" value={snapshot.importGroupId} />
            <input
              name="draftsPayload"
              type="hidden"
              value={JSON.stringify(
                editableItems.map((entry) => ({
                  draftId: entry.id,
                  ...entry.values
                }))
              )}
            />
            <SubmitButton
              disabled={!canConfirm}
              pendingLabel="保存して確定中..."
              testId="review-confirm-submit"
            >
              保存して確定
            </SubmitButton>
          </form>
        )}
        <div style={{ height: 12 }} />
        <form action={discardImportGroupAction}>
          <input name="importGroupId" type="hidden" value={snapshot.importGroupId} />
          <ConfirmSubmitButton
            className="button button-secondary"
            confirmationMessage="この取り込みを破棄しますか？確認前データはまとめて削除されます。"
            testId="review-discard-import-group"
          >
            この取り込みを破棄
          </ConfirmSubmitButton>
        </form>
      </section>
    </div>
  );
}
