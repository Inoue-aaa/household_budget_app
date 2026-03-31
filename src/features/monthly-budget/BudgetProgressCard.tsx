import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { MonthlyBudgetOverview } from "@/lib/finance/types";
import { formatCurrency } from "@/lib/utils/format";

type BudgetProgressCardProps = {
  budget: MonthlyBudgetOverview;
};

function clampRate(rate: number | null) {
  if (rate == null || Number.isNaN(rate)) {
    return 0;
  }

  return Math.max(0, Math.min(rate, 1));
}

function formatBudgetMonth(targetMonth: string) {
  return targetMonth.slice(0, 7).replace("-", ".");
}

export function BudgetProgressCard({ budget }: BudgetProgressCardProps) {
  const usedRatio = clampRate(budget.usageRate);
  const remainingRatio =
    budget.hasBudget && !budget.isOverBudget ? Math.max(0, 1 - usedRatio) : 0;
  const selectedCategoryNames = budget.selectedCategories.map((category) => category.name).join(" / ");

  return (
    <section className="surface budget-hero-card">
      <div className="budget-hero-header">
        <div>
          <p className="eyebrow">Budget</p>
          <h2 className="budget-hero-title">予算状況（{formatBudgetMonth(budget.targetMonth)}）</h2>
        </div>
      </div>

      {!budget.hasBudget ? (
        <div className="budget-empty-state">
          <p className="section-title">予算がまだ設定されていません</p>
          <p className="section-copy">今月の予算を設定すると、残り予算や進捗をホームから確認できます。</p>
        </div>
      ) : (
        <>
          <div className="budget-hero-main">
            <div>
              <span className="budget-hero-amount-label">予算残高</span>
              <strong className="budget-hero-amount">
                {formatCurrency(budget.remainingAmount ?? 0)}
              </strong>
            </div>
            <div
              className={`budget-status-badge${budget.isOverBudget ? " budget-status-badge-over" : ""}`}
            >
              {budget.isOverBudget ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {budget.isOverBudget ? "予算超過" : "予算内"}
            </div>
          </div>

          <div className="budget-sub-stats">
            <div className="budget-sub-stat">
              <span className="budget-sub-stat-label">全体予算</span>
              <strong className="budget-sub-stat-value">
                {formatCurrency(budget.monthlyBudget ?? 0)}
              </strong>
            </div>
            <div className="budget-sub-stat">
              <span className="budget-sub-stat-label">使用額</span>
              <strong className="budget-sub-stat-value">{formatCurrency(budget.spentAmount)}</strong>
            </div>
            <div className="budget-sub-stat">
              <span className="budget-sub-stat-label">進捗率</span>
              <strong className="budget-sub-stat-value">
                {budget.usageRate != null ? `${Math.round(budget.usageRate * 100)}%` : "0%"}
              </strong>
            </div>
          </div>

          <div className="budget-progress-shell" aria-label="予算進捗バー">
            {budget.isOverBudget ? (
              <div className="budget-progress budget-progress-over" style={{ width: "100%" }} />
            ) : (
              <>
                <div
                  className="budget-progress budget-progress-used"
                  style={{ width: `${usedRatio * 100}%` }}
                />
                <div
                  className="budget-progress budget-progress-remaining"
                  style={{ width: `${remainingRatio * 100}%` }}
                />
              </>
            )}
          </div>

          <div className="budget-hero-footer">
            <p className="budget-copy">
              {budget.hasSelectedCategories
                ? `集計対象: ${selectedCategoryNames}`
                : "カテゴリ別予算が未設定のため、今月の支出全体を集計しています。"}
            </p>
            <Link className="list-row list-row-link budget-hero-detail-row" href={`/home/budget/detail?month=${budget.targetMonth.slice(0, 7)}`}>
              <span className="list-title">詳細</span>
              <strong aria-hidden="true">›</strong>
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
