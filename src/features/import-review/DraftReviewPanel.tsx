import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { SubmitButton } from "@/components/SubmitButton";
import {
  addDraftRowAction,
  confirmDraftsAction,
  discardImportGroupAction,
  deleteDraftRowAction
} from "@/features/import-review/actions";
import { DraftReviewRowForm } from "@/features/import-review/DraftReviewRowForm";
import type { DraftReviewSnapshot, SourceType } from "@/lib/finance/types";
import { formatCurrency, formatDisplayDate, formatSourceLabel } from "@/lib/utils/format";

type DraftReviewPanelProps = {
  snapshot: DraftReviewSnapshot;
};

function merchantFieldLabel(sourceType: SourceType) {
  return sourceType === "credit_screenshot" ? "利用先" : "店舗名";
}

function merchantFieldHint(sourceType: SourceType) {
  return sourceType === "credit_screenshot"
    ? "カード明細に表示された利用先を入力できます。"
    : "レシートに表示された店舗名があれば入力できます。";
}

function itemTitleHint(sourceType: SourceType) {
  return sourceType === "credit_screenshot"
    ? "明細名や利用先ベースの内容で問題ありません。後から一覧で見返しやすい名前にしてください。"
    : "商品名や支出内容が分かる形に揃えてください。";
}

export function DraftReviewPanel({ snapshot }: DraftReviewPanelProps) {
  const attentionItems = snapshot.items.filter((item) => item.needsReview);
  const merchantLabel = merchantFieldLabel(snapshot.sourceType);
  const merchantHint = merchantFieldHint(snapshot.sourceType);
  const titleHint = itemTitleHint(snapshot.sourceType);

  return (
    <div className="page-stack">
      <section className="surface review-summary">
        <div className="review-summary-header">
          <div>
            <p className="eyebrow">Review</p>
            <h1 className="screen-title">確認画面</h1>
            <p className="screen-description">
              一覧で内容を整えてから、保存済み支出として確定します。
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
            <span className="stat-label">確認が必要</span>
            <strong className="stat-value">{snapshot.needsReviewCount}件</strong>
          </div>
        </div>

        <p className="section-copy">
          取り込み: {snapshot.title ?? "未設定"}
          {snapshot.occurredOn ? ` ・ ${formatDisplayDate(snapshot.occurredOn)}` : ""}
        </p>

        {snapshot.ocrDebug ? (
          <p className="section-copy">
            requested mode: {snapshot.ocrDebug.requestedProviderMode} ・ actual mode:{" "}
            {snapshot.ocrDebug.providerMode} ・ provider:{" "}
            {snapshot.ocrDebug.providerName ?? "unknown"}
            {snapshot.ocrDebug.fallbackUsed ? " ・ fallback used" : ""}
            {snapshot.ocrDebug.errorCode ? ` ・ error: ${snapshot.ocrDebug.errorCode}` : ""}
          </p>
        ) : null}
      </section>

      <section className="surface section-card">
        <h2 className="section-title">確認が必要な項目</h2>
        <p className="section-copy">
          金額やカテゴリだけでなく、日付と{merchantLabel}もここで整えられます。
        </p>
        <div style={{ height: 16 }} />
        {attentionItems.length === 0 ? (
          <p className="section-copy">現在は追加で確認が必要な項目はありません。</p>
        ) : (
          <div className="attention-list">
            {attentionItems.map((item) => (
              <div className="attention-item" key={item.id}>
                <div>
                  <p className="list-title">{item.title || `明細 ${item.lineIndex + 1}`}</p>
                  <p className="list-meta">
                    金額: {item.amount == null ? "未入力" : formatCurrency(item.amount)} ・ カテゴリ:{" "}
                    {item.categoryName ?? "未設定"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="surface section-card">
        <div className="review-section-header">
          <div>
            <h2 className="section-title">明細一覧</h2>
            <p className="section-copy">必要に応じて行追加、保存、削除ができます。</p>
          </div>
          <form action={addDraftRowAction}>
            <input name="importGroupId" type="hidden" value={snapshot.importGroupId} />
            <button className="button button-secondary compact-button" type="submit">
              行を追加
            </button>
          </form>
        </div>

        <div style={{ height: 16 }} />

        {snapshot.items.length === 0 ? (
          <div className="empty-state">
            <p className="section-title">確認対象の行がありません。</p>
            <p className="section-copy">行を追加して、必要な内容を入力してください。</p>
          </div>
        ) : (
          <div className="review-list">
            {snapshot.items.map((item) => (
              <article
                className={`review-row-card ${item.needsReview ? "review-row-card-attention" : ""}`}
                data-testid={`review-row-${item.id}`}
                key={item.id}
              >
                <div className="review-row-top">
                  <div>
                    <p className="list-title">明細 {item.lineIndex + 1}</p>
                    <p className="list-meta">
                      {item.merchantName ? `${item.merchantName} ・ ` : ""}
                      {item.occurredOn ? formatDisplayDate(item.occurredOn) : "日付未設定"}
                    </p>
                  </div>
                  <span className={`pill ${item.needsReview ? "pill-accent" : ""}`}>
                    {item.needsReview ? "確認が必要" : "入力済み"}
                  </span>
                </div>

                <DraftReviewRowForm
                  categories={snapshot.categories}
                  importGroupId={snapshot.importGroupId}
                  item={item}
                  merchantHint={merchantHint}
                  merchantLabel={merchantLabel}
                  sourceType={snapshot.sourceType}
                  titleHint={titleHint}
                />

                <form action={deleteDraftRowAction}>
                  <input name="importGroupId" type="hidden" value={snapshot.importGroupId} />
                  <input name="draftId" type="hidden" value={item.id} />
                  <button
                    className="button button-secondary compact-button"
                    data-testid={`review-row-${item.id}-delete`}
                    type="submit"
                  >
                    行を削除
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="surface section-card">
        <h2 className="section-title">保存して確定</h2>
        <p className="section-copy">
          保存すると expenses に移動し、確認前データは引き続き保持されません。
        </p>
        <div style={{ height: 16 }} />
        {snapshot.items.length === 0 ? (
          <p className="section-copy">
            確定する行がありません。必要に応じて行を追加してください。
          </p>
        ) : (
          <form action={confirmDraftsAction}>
            <input name="importGroupId" type="hidden" value={snapshot.importGroupId} />
            <SubmitButton pendingLabel="保存して確定中..." testId="review-confirm-submit">
              保存して確定
            </SubmitButton>
          </form>
        )}
        <div style={{ height: 12 }} />
        <form action={discardImportGroupAction}>
          <input name="importGroupId" type="hidden" value={snapshot.importGroupId} />
          <ConfirmSubmitButton
            className="button button-secondary"
            confirmationMessage="この取り込みを破棄します。確認前データはまとめて削除されます。よろしいですか。"
            testId="review-discard-import-group"
          >
            この取り込みを破棄
          </ConfirmSubmitButton>
        </form>
      </section>
    </div>
  );
}
