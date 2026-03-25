import Link from "next/link";
import { ExpensesStatusBanner } from "./ExpensesStatusBanner";
import { ImportGroupDeleteForm } from "./ImportGroupDeleteForm";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { getExpensesPageSnapshot } from "@/lib/finance/queries";
import {
  formatCurrency,
  formatDisplayDate,
  formatImportGroupHeading,
  formatImportGroupMetaLabel,
  formatSourceLabel,
} from "@/lib/utils/format";

export default async function ExpensesPage() {
  const snapshot = await getExpensesPageSnapshot();

  return (
    <div className="page-stack">
      <ExpensesStatusBanner />

      <ScreenHeader
        eyebrow="Expenses"
        title="支出"
        description="保存済み支出の確認と、レポート・登録履歴への入口をまとめています。削除は取り込み単位で行えます。"
      />

      <section className="stats-grid">
        <div className="surface stat-card stat-card-accent">
          <span className="stat-label">表示件数</span>
          <strong className="stat-value">{snapshot.totalCount}件</strong>
        </div>
        <div className="surface stat-card">
          <span className="stat-label">表示合計</span>
          <strong className="stat-value">
            {formatCurrency(snapshot.totalAmount)}
          </strong>
        </div>
      </section>

      <Link
        className="surface section-card section-card-link"
        href="/expenses/reports"
      >
        <div className="section-card-link-header">
          <h2 className="section-title">支出レポート</h2>
          <span className="section-card-link-arrow" aria-hidden="true">
            ›
          </span>
        </div>
        <p className="section-copy">
          月別の推移と、日ごとの金額の偏りを確認できます。各日付から日別詳細にも進めます。
        </p>
      </Link>

      <Link
        className="surface section-card section-card-link"
        href="/expenses/history"
      >
        <div className="section-card-link-header">
          <h2 className="section-title">登録履歴一覧</h2>
          <span className="section-card-link-arrow" aria-hidden="true">
            ›
          </span>
        </div>
        <p className="section-copy">
          保存済みの支出を日ごとに振り返れます。気になる日付から詳細画面へ進めます。
        </p>
      </Link>

      <SectionCard
        title="最近の登録履歴"
        description="直近の保存済み支出を取り込み単位で表示しています。不要な取り込みはここから削除できます。"
      >
        <div className="list">
          {snapshot.groups.length === 0 ? (
            <div className="empty-state">
              <p className="section-title">まだ支出は保存されていません</p>
              <p className="section-copy">
                手入力や review
                の保存を行うと、ここに登録履歴として表示されます。
              </p>
              <div style={{ height: 14 }} />
              <Link className="button" href="/register/manual">
                手入力で登録する
              </Link>
            </div>
          ) : (
            snapshot.groups.map((group) => (
              <section
                className="expense-card"
                data-testid="expenses-group"
                key={group.importGroupId}
              >
                <div className="expense-card-main">
                  <div className="expense-card-overline">
                    <span className="pill pill-accent">
                      {formatSourceLabel(group.sourceType)}
                    </span>
                    <span className="expense-card-date">
                      {formatDisplayDate(group.occurredOn)}
                    </span>
                  </div>

                  <div className="expense-card-header">
                    <div>
                      <p className="expense-group-label">
                        {formatImportGroupHeading(group.sourceType)}
                      </p>
                      <p className="list-title">
                        {group.merchantName ?? "店舗名なし"}
                      </p>
                      <p className="list-meta">
                        {formatImportGroupMetaLabel(group.sourceType)}:{" "}
                        {formatSourceLabel(group.sourceType)}
                      </p>
                    </div>
                    <strong className="expense-amount">
                      {formatCurrency(group.totalAmount)}
                    </strong>
                  </div>

                  <div className="expense-summary-grid">
                    <div className="expense-summary-card">
                      <span className="expense-summary-label">明細数</span>
                      <strong className="expense-summary-value">
                        {group.itemCount}件
                      </strong>
                    </div>
                    <div className="expense-summary-card">
                      <span className="expense-summary-label">合計金額</span>
                      <strong className="expense-summary-value">
                        {formatCurrency(group.totalAmount)}
                      </strong>
                    </div>
                  </div>

                  <div className="expense-detail-list">
                    {group.items.map((expense) => (
                      <div className="list-row" key={expense.id}>
                        <div>
                          <p className="list-title">{expense.title}</p>
                          <p className="list-meta">
                            {expense.merchantName
                              ? `${expense.merchantName} ・ `
                              : ""}
                            {formatDisplayDate(expense.occurredOn)} ・{" "}
                            {expense.categoryName}
                            {expense.note ? ` ・ ${expense.note}` : ""}
                          </p>
                        </div>
                        <strong>{formatCurrency(expense.amount)}</strong>
                      </div>
                    ))}
                  </div>

                  <ImportGroupDeleteForm
                    importGroupId={group.importGroupId}
                    sourceType={group.sourceType}
                  />
                </div>
              </section>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  );
}
