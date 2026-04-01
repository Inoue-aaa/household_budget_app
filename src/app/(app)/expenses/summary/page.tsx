import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { MonthYearPickerFields } from "@/components/MonthYearPickerFields";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { getMonthlySummarySnapshot } from "@/lib/finance/queries";
import { formatCurrency, resolveSearchMonth } from "@/lib/utils/format";

type MonthlySummaryPageProps = {
  searchParams?: Promise<{
    month?: string;
    year?: string;
    monthNumber?: string;
  }>;
};

function formatDifferenceLabel(amount: number) {
  if (amount > 0) {
    return "先月より増加";
  }

  if (amount < 0) {
    return "先月より減少";
  }

  return "先月と同程度";
}

function clampRate(rate: number | null) {
  if (rate == null || Number.isNaN(rate)) {
    return 0;
  }

  return Math.max(0, Math.min(rate, 1));
}

export default async function MonthlySummaryPage({
  searchParams,
}: MonthlySummaryPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const snapshot = await getMonthlySummarySnapshot(resolveSearchMonth(params));
  const usageRate = clampRate(snapshot.usageRate);
  const hasBudget = snapshot.budgetAmount != null;

  return (
    <div className="page-stack">
      <ScreenHeader
        eyebrow="Summary"
        title="月次サマリー"
        description={`${snapshot.monthLabel}の支出、予算、カテゴリ別の傾向を確認できます。`}
        action={
          <Link
            className="button button-secondary compact-button action-button action-button-secondary"
            href={`/expenses/summary/trend?year=${snapshot.targetMonth.slice(0, 4)}&month=${snapshot.targetMonth}`}
          >
            グラフ表示
          </Link>
        }
      />

      <SectionCard title="表示月">
        <form className="field-stack budget-inline-form" method="get">
          <MonthYearPickerFields
            availableMonths={snapshot.availableMonths}
            targetMonth={snapshot.targetMonth}
          />
          <button className="button button-secondary" type="submit">
            この月を表示
          </button>
        </form>
      </SectionCard>

      <section className="surface budget-hero-card monthly-summary-budget-card">
        <div className="budget-hero-header">
          <div>
            <h2 className="budget-hero-title">{snapshot.monthLabel}</h2>
          </div>
        </div>

        <div className="budget-hero-main">
          <div>
            <span className="budget-hero-amount-label">総支出</span>
            <strong className="budget-hero-amount">
              {formatCurrency(snapshot.totalAmount)}
            </strong>
          </div>
        </div>

        <div className="budget-sub-stats">
          <div className="budget-sub-stat">
            <span className="budget-sub-stat-label">全体予算</span>
            <strong className="budget-sub-stat-value">
              {hasBudget ? formatCurrency(snapshot.budgetAmount ?? 0) : "予算未設定"}
            </strong>
          </div>
          <div className="budget-sub-stat">
            <span className="budget-sub-stat-label">予算使用額</span>
            <strong className="budget-sub-stat-value">
              {formatCurrency(snapshot.totalAmount)}
            </strong>
          </div>
          <div className="budget-sub-stat">
            <span className="budget-sub-stat-label">進捗率</span>
            <strong className="budget-sub-stat-value">
              {hasBudget ? `${Math.round(usageRate * 100)}%` : "予算未設定"}
            </strong>
          </div>
        </div>

        {hasBudget ? (
          <>
          <div className="budget-progress-shell" aria-label="月次予算の進捗">
            <div
              className={`budget-progress ${
                snapshot.differenceFromBudget != null && snapshot.differenceFromBudget < 0
                  ? "budget-progress-over"
                  : "budget-progress-used"
              }`}
              style={{
                width: `${
                  snapshot.differenceFromBudget != null && snapshot.differenceFromBudget < 0
                    ? 100
                    : usageRate * 100
                }%`,
              }}
            />
            {snapshot.differenceFromBudget != null && snapshot.differenceFromBudget >= 0 ? (
              <div
                className="budget-progress budget-progress-remaining"
                style={{ width: `${Math.max(0, 100 - usageRate * 100)}%` }}
              />
            ) : null}
          </div>

          <Link
            className="list-row list-row-link budget-hero-detail-row"
            href={`/home/budget/detail?month=${snapshot.targetMonth.slice(0, 7)}`}
          >
            <span className="list-title">予算内訳</span>
            <strong aria-hidden="true">›</strong>
          </Link>
          </>
        ) : null}
      </section>

      <section className="stats-grid">
        <div className="surface stat-card">
          <span className="stat-label">先月比</span>
          <strong className="stat-value">
            {formatCurrency(Math.abs(snapshot.differenceFromPreviousMonth))}
          </strong>
          <span className="list-meta">{formatDifferenceLabel(snapshot.differenceFromPreviousMonth)}</span>
        </div>
        <div className="surface stat-card">
          <span className="stat-label">固定費 / 変動費</span>
          <strong className="stat-value">
            {formatCurrency(snapshot.fixedAmount)} / {formatCurrency(snapshot.variableAmount)}
          </strong>
        </div>
      </section>

      <SectionCard title="カテゴリ別支出">
        <div className="list">
          {snapshot.topCategories.length === 0 ? (
            <div className="empty-state">
              <p className="section-title">この月の支出はまだありません</p>
              <p className="section-copy">
                支出が保存されると、ここにカテゴリ別の内訳が表示されます。
              </p>
            </div>
          ) : (
            snapshot.topCategories.map((item) => (
              <div className="list-row list-row-budget" key={item.categoryId}>
                <div className="budget-detail-row-main">
                  <div>
                    <p className="list-title">{item.categoryName}</p>
                    <p className="list-meta">全体の {Math.round(item.shareRate * 100)}%</p>
                  </div>
                  <div className="budget-detail-row-side">
                    <strong>{formatCurrency(item.totalAmount)}</strong>
                  </div>
                </div>

                <div className="budget-progress-shell budget-progress-shell-inline" aria-hidden="true">
                  <div
                    className="budget-progress budget-progress-used"
                    style={{ width: `${Math.max(4, item.shareRate * 100)}%` }}
                  />
                  <div
                    className="budget-progress budget-progress-remaining"
                    style={{ width: `${Math.max(0, 100 - item.shareRate * 100)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      <div className="single-action-row">
        <BackButton
          className="button button-secondary compact-button action-button action-button-secondary bottom-back-button"
          fallbackHref="/expenses"
        />
      </div>
    </div>
  );
}
