"use client";

import { useMemo, useState } from "react";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { SubmitButton } from "@/components/SubmitButton";
import {
  confirmDraftsAction,
  discardImportGroupAction
} from "@/features/import-review/actions";
import {
  DraftReviewRowForm,
  type DraftReviewEditableValues
} from "@/features/import-review/DraftReviewRowForm";
import type { DraftReviewItem, DraftReviewSnapshot, SourceType } from "@/lib/finance/types";
import { formatDisplayDate, formatSourceLabel } from "@/lib/utils/format";

type DraftReviewPanelProps = {
  snapshot: DraftReviewSnapshot;
};

type EditableDraftItem = {
  id: string;
  draftId: string | null;
  lineIndex: number;
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
      draftId: item.id,
      lineIndex: item.lineIndex,
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

function createNewEditableItem(snapshot: DraftReviewSnapshot, lineIndex: number): EditableDraftItem {
  return {
    id: `new-${crypto.randomUUID()}`,
    draftId: null,
    lineIndex,
    baseAmount: "",
    taxRate: 0,
    values: {
      occurredOn: normalizeEditableOccurredOn(snapshot.occurredOn),
      merchantName: snapshot.title ?? "",
      title: "",
      amount: "",
      categoryId: snapshot.categories[0]?.id ?? "",
      note: ""
    }
  };
}

function buildDraftReviewItem(
  entry: EditableDraftItem,
  snapshot: DraftReviewSnapshot
): DraftReviewItem {
  return {
    id: entry.id,
    importGroupId: snapshot.importGroupId,
    lineIndex: entry.lineIndex,
    title: entry.values.title,
    amount: entry.values.amount ? Number(entry.values.amount) : null,
    note: entry.values.note || null,
    merchantName: entry.values.merchantName || null,
    occurredOn: entry.values.occurredOn || null,
    categoryId: entry.values.categoryId || null,
    categoryName:
      snapshot.categories.find((category) => category.id === entry.values.categoryId)?.name ?? null,
    sourceType: snapshot.sourceType,
    needsReview:
      !entry.values.title.trim() ||
      !entry.values.amount.trim() ||
      Number(entry.values.amount) <= 0 ||
      !entry.values.categoryId
  };
}

export function DraftReviewPanel({ snapshot }: DraftReviewPanelProps) {
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [editableItems, setEditableItems] = useState<EditableDraftItem[]>(() =>
    createEditableItems(snapshot)
  );
  const merchantLabel = merchantFieldLabel(snapshot.sourceType);

  const reviewedIdSet = useMemo(() => new Set(reviewedIds), [reviewedIds]);
  const deletedIdSet = useMemo(() => new Set(deletedIds), [deletedIds]);

  const visibleItems = useMemo(
    () =>
      editableItems
        .filter((item) => !deletedIdSet.has(item.id))
        .map((item, index) =>
          buildDraftReviewItem(
            {
              ...item,
              lineIndex: index
            },
            snapshot
          )
        ),
    [deletedIdSet, editableItems, snapshot]
  );

  const remainingItems = useMemo(
    () => visibleItems.filter((item) => !reviewedIdSet.has(item.id)),
    [reviewedIdSet, visibleItems]
  );

  const canConfirm = visibleItems.length > 0 && remainingItems.length === 0;

  return (
    <div className="page-stack review-page review-page-wide">
      <section className="surface review-summary review-surface review-surface-wide">
        <div className="review-summary-header">
          <div>
            <p className="eyebrow">Review</p>
            <h1 className="screen-title">確認画面</h1>
            <p className="screen-description review-copy">
              自動で取り込まれた内容を確認してから、支出として登録します。
            </p>
          </div>
          <span className="pill pill-accent">{formatSourceLabel(snapshot.sourceType)}</span>
        </div>

        <div className="review-summary-grid">
          <div className="review-summary-card">
            <span className="stat-label">確認対象</span>
            <strong className="stat-value">{visibleItems.length}件</strong>
          </div>
          <div className="review-summary-card">
            <span className="stat-label">未確認</span>
            <strong className="stat-value">{remainingItems.length}件</strong>
          </div>
        </div>

        <p className="section-copy review-copy">
          読み込み元: {snapshot.title ?? "未設定"}
          {snapshot.occurredOn ? ` ・ ${formatDisplayDate(snapshot.occurredOn)}` : ""}
        </p>
      </section>

      <section className="surface section-card review-surface review-surface-tight review-surface-wide">
        <h2 className="section-title">未確認の支出</h2>
        {remainingItems.length === 0 ? (
          <p className="section-copy review-copy">
            すべての支出を確認済みにしました。このまま登録へ進めます。
          </p>
        ) : (
          <div className="attention-item attention-item-compact">
            <p className="section-copy review-copy">
              未確認の支出が {remainingItems.length} 件あります。リストを確認してから、まとめて登録してください。
            </p>
          </div>
        )}
      </section>

      <section className="surface section-card review-surface review-surface-tight review-surface-wide">
        <div className="review-section-header">
          <div>
            <h2 className="section-title">支出一覧</h2>
            <p className="section-copy review-copy">
              自動で取り込まれた内容を確認してから、支出として登録します。
            </p>
          </div>
        </div>

        <div style={{ height: 12 }} />

        {visibleItems.length === 0 ? (
          <div className="empty-state">
            <p className="section-title">確認対象の支出がありません</p>
            <p className="section-copy review-copy">
              新規追加して、必要な支出をここから登録できます。
            </p>
          </div>
        ) : (
          <div className="review-list">
            {visibleItems.map((item) => {
              const isReviewed = reviewedIdSet.has(item.id);
              const editableItem = editableItems.find((entry) => entry.id === item.id);

              if (!editableItem) {
                return null;
              }

              return (
                <article
                  className={`review-row-card ${!isReviewed ? "review-row-card-attention" : ""} ${
                    isReviewed ? "review-row-card-reviewed" : ""
                  }`}
                  data-testid={`review-row-${item.id}`}
                  key={item.id}
                >
                  <div className="review-row-top">
                    <div>
                      <p className="list-title">支出 {item.lineIndex + 1}</p>
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
                        className={`review-check-toggle ${
                          !isReviewed ? "review-check-toggle-attention" : ""
                        } ${isReviewed ? "review-check-toggle-active" : ""}`}
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
                        <span>{isReviewed ? "確認済み" : "確認する"}</span>
                      </button>
                    </div>
                  </div>

                  <DraftReviewRowForm
                    baseAmount={editableItem.baseAmount}
                    categories={snapshot.categories}
                    item={item}
                    merchantLabel={merchantLabel}
                    onChange={(field, value) => {
                      setEditableItems((current) =>
                        current.map((entry) => {
                          if (entry.id !== item.id) return entry;
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
                    onDelete={() => {
                      setDeletedIds((current) =>
                        current.includes(item.id) ? current : [...current, item.id]
                      );
                      setReviewedIds((current) => current.filter((id) => id !== item.id));
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

        <div className="review-add-row-footer single-action-row">
          <button
            className="button button-secondary review-add-row-button"
            onClick={() => {
              setEditableItems((current) => [...current, createNewEditableItem(snapshot, current.length)]);
            }}
            type="button"
          >
            新規追加
          </button>
        </div>
      </section>

      <section className="surface section-card review-surface review-surface-wide">
        <h2 className="section-title">登録して反映</h2>
        <p className="section-copy review-copy">
          {canConfirm
            ? "すべて確認済みです。まとめて登録して、家計簿へ反映できます。"
            : `未確認の支出が ${remainingItems.length} 件あります。すべて確認済みにしてから登録してください。`}
        </p>
        <div style={{ height: 14 }} />
        {visibleItems.length === 0 ? (
          <p className="section-copy review-copy">
            登録できる支出がありません。必要に応じて支出を追加してください。
          </p>
        ) : (
          <form action={confirmDraftsAction}>
            <input name="importGroupId" type="hidden" value={snapshot.importGroupId} />
            <input
              name="draftsPayload"
              type="hidden"
              value={JSON.stringify(
                editableItems
                  .filter((entry) => !deletedIdSet.has(entry.id))
                  .map((entry, index) => ({
                    draftId: entry.draftId,
                    lineIndex: index,
                    ...entry.values
                  }))
              )}
            />
            <input
              name="deletedDraftIdsPayload"
              type="hidden"
              value={JSON.stringify(
                deletedIds.filter((id) => !id.startsWith("new-"))
              )}
            />
            <SubmitButton
              disabled={!canConfirm}
              pendingLabel="登録して反映中..."
              testId="review-confirm-submit"
            >
              登録して反映
            </SubmitButton>
          </form>
        )}
        <div style={{ height: 12 }} />
        <form action={discardImportGroupAction}>
          <input name="importGroupId" type="hidden" value={snapshot.importGroupId} />
          <ConfirmSubmitButton
            className="button button-secondary"
            confirmationMessage="この読み込み結果を破棄しますか？確認用データはまとめて削除されます。"
            testId="review-discard-import-group"
          >
            この読み込みを破棄
          </ConfirmSubmitButton>
        </form>
      </section>
    </div>
  );
}
