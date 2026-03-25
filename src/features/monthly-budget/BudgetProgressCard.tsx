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
  const remainingRatio = budget.hasBudget && !budget.isOverBudget ? Math.max(0, 1 - usedRatio) : 0;
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
          <p className="section-title">今月の予算はまだ設定されていません</p>
          <p className="section-copy">
            先に予算額と対象カテゴリを設定すると、ホーム上で今月の残り使える額を確認できます。
          </p>
        </div>
      ) : (
        <>
          <div className="budget-stat-grid">
            <div className="budget-stat-card">
              <span className="budget-stat-label">予算額</span>
              <strong className="budget-stat-value">{formatCurrency(budget.monthlyBudget ?? 0)}</strong>
            </div>
            <div className="budget-stat-card">
              <span className="budget-stat-label">使用額</span>
              <strong className="budget-stat-value">{formatCurrency(budget.spentAmount)}</strong>
            </div>
            <div className="budget-stat-card">
              <span className="budget-stat-label">残り使える額</span>
              <strong className="budget-stat-value">
                {formatCurrency(budget.remainingAmount ?? 0)}
              </strong>
            </div>
            <div className="budget-stat-card">
              <span className="budget-stat-label">使用率</span>
              <strong className="budget-stat-value">
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

          <p className="budget-copy">
            {budget.hasSelectedCategories
              ? `集計対象: ${selectedCategoryNames}`
              : "集計対象カテゴリはまだ選ばれていません。予算設定で選択してください。"}
          </p>
        </>
      )}
    </section>
  );
}
