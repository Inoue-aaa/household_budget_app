import Link from "next/link";
import type { Route } from "next";
import { BarChart3, ChartColumnBig, NotebookPen } from "lucide-react";
import { NoticeBanner } from "@/components/NoticeBanner";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { ImportGroupDeleteForm } from "@/app/(app)/expenses/ImportGroupDeleteForm";
import type { ExpensesPageSnapshot } from "@/lib/finance/types";
import { getExpensesNotice } from "@/lib/ui/notices";
import {
  formatCurrency,
  formatDisplayDate,
  formatImportGroupHeading,
  formatImportGroupMetaLabel,
  formatSourceLabel,
} from "@/lib/utils/format";

type ExpensesTabPanelProps = {
  snapshot: ExpensesPageSnapshot;
  noticeCode?: string;
};

export function ExpensesTabPanel({
  snapshot,
  noticeCode,
}: ExpensesTabPanelProps) {
  const notice = getExpensesNotice(noticeCode);

  return (
    <div className="page-stack tab-panel-stack">
      {notice ? (
        <NoticeBanner
          tone={notice.tone}
          title={notice.title}
          description={notice.description}
        />
      ) : null}

      <ScreenHeader
        eyebrow="Expenses"
        title="支出"
        description="登録済みの支出を確認・修正できます。"
      />

      <section className="stats-grid">
        <div className="surface stat-card stat-card-accent">
          <span className="stat-label">品目件数</span>
          <strong className="stat-value">{snapshot.totalCount}件</strong>
        </div>
        <div className="surface stat-card">
          <span className="stat-label">支出合計</span>
          <strong className="stat-value">
            {formatCurrency(snapshot.totalAmount)}
          </strong>
        </div>
      </section>

      <Link className="surface section-card section-card-link" href="/expenses/reports">
        <div className="section-card-link-header">
          <div className="section-card-link-title">
            <span className="section-card-link-icon" aria-hidden="true">
              <BarChart3 size={18} />
            </span>
            <h2 className="section-title">日次レポート</h2>
          </div>
          <span aria-hidden="true" className="section-card-link-arrow">
            ›
          </span>
        </div>
        <p className="section-copy">
          表示月の日別支出を確認できます。各日から詳細へ進み、個別の修正も行えます。
        </p>
      </Link>

      <Link className="surface section-card section-card-link" href="/expenses/summary">
        <div className="section-card-link-header">
          <div className="section-card-link-title">
            <span className="section-card-link-icon section-card-link-icon-soft" aria-hidden="true">
              <ChartColumnBig size={18} />
            </span>
            <h2 className="section-title">月次サマリー</h2>
          </div>
          <span aria-hidden="true" className="section-card-link-arrow">
            ›
          </span>
        </div>
        <p className="section-copy">
          月全体の支出、予算との差、固定費と変動費の傾向を確認できます。
        </p>
      </Link>

      <Link className="surface section-card section-card-link" href="/expenses/history">
        <div className="section-card-link-header">
          <div className="section-card-link-title">
            <span className="section-card-link-icon section-card-link-icon-soft" aria-hidden="true">
              <NotebookPen size={18} />
            </span>
            <h2 className="section-title">登録履歴</h2>
          </div>
          <span aria-hidden="true" className="section-card-link-arrow">
            ›
          </span>
        </div>
        <p className="section-copy">
          登録済み支出を日ごとに振り返れます。日付を起点に、その日の詳細へ移動できます。
        </p>
      </Link>

      <SectionCard
        title="最近の登録履歴"
        description="直近の登録済み支出を、取り込み単位で表示しています。不要な取り込みはここから削除できます。"
      >
        <div className="list">
          {snapshot.groups.length === 0 ? (
            <div className="empty-state">
              <p className="section-title">まだ支出は登録されていません</p>
              <p className="section-copy">
                手入力や確認画面の保存を行うと、ここに登録履歴として表示されます。
              </p>
              <div style={{ height: 14 }} />
              <Link
                className="button action-button action-button-primary"
                href="/register/manual"
              >
                手入力で登録する
              </Link>
            </div>
          ) : (
            snapshot.groups.map((group) => {
              const editHref = (
                group.occurredOn != null
                  ? `/expenses/day/${group.occurredOn}`
                  : "/expenses/history"
              ) as Route;

              return (
                <section
                  className="expense-card"
                  data-testid="expenses-group"
                  key={group.importGroupId}
                >
                  <div className="expense-card-main">
                    <div className="expense-card-overline">
                      <span className="pill pill-accent">
                        {formatSourceLabel(group.sourceType, group.recurringExpenseId)}
                      </span>
                      <span className="expense-card-date">
                        {formatDisplayDate(group.occurredOn)}
                      </span>
                    </div>

                    <div className="expense-card-header">
                      <div>
                        <p className="expense-group-label">
                          {formatImportGroupHeading(group.sourceType, group.recurringExpenseId)}
                        </p>
                        <p className="list-title">
                          {group.merchantName ?? "店舗名なし"}
                        </p>
                        <p className="list-meta">
                          {formatImportGroupMetaLabel(group.sourceType, group.recurringExpenseId)}:{" "}
                          {formatSourceLabel(group.sourceType, group.recurringExpenseId)}
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

                    <div className="action-button-row action-button-row-centered expense-card-action-row">
                      <ImportGroupDeleteForm
                        importGroupId={group.importGroupId}
                      />
                      <Link
                        className="button compact-button action-button action-button-primary"
                        href={editHref}
                      >
                        修正
                      </Link>
                    </div>
                  </div>
                </section>
              );
            })
          )}
        </div>
      </SectionCard>
    </div>
  );
}
