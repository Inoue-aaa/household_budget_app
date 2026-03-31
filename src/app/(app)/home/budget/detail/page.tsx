import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { getMonthlyBudgetDetailSnapshot } from "@/lib/finance/queries";
import { formatCurrency } from "@/lib/utils/format";

function clampRate(rate: number | null) {
  if (rate == null || Number.isNaN(rate)) {
    return 0;
  }

  return Math.max(0, Math.min(rate, 1));
}

type BudgetDetailPageProps = {
  searchParams?: Promise<{
    month?: string;
  }>;
};

export default async function BudgetDetailPage({
  searchParams,
}: BudgetDetailPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const snapshot = await getMonthlyBudgetDetailSnapshot(params?.month);
  const progressRate = clampRate(snapshot.totalUsageRate);

  return (
    <div className="page-stack">
      <ScreenHeader
        eyebrow="Budget"
        title="予算詳細"
        description={`${snapshot.monthLabel}の予算、使用額、カテゴリ別の進捗を確認できます。`}
      />

      <section className="surface budget-hero-card">
        <div className="budget-hero-header">
          <div>
            <h2 className="budget-hero-title">{snapshot.monthLabel}</h2>
          </div>
        </div>

        {snapshot.hasBudget ? (
          <>
            <div className="budget-hero-main">
              <div>
                <span className="budget-hero-amount-label">予算残高</span>
                <strong className="budget-hero-amount">
                  {formatCurrency(snapshot.totalRemaining ?? 0)}
                </strong>
              </div>
            </div>

            <div className="budget-sub-stats">
              <div className="budget-sub-stat">
                <span className="budget-sub-stat-label">全体予算</span>
                <strong className="budget-sub-stat-value">
                  {formatCurrency(snapshot.totalBudget ?? 0)}
                </strong>
              </div>
              <div className="budget-sub-stat">
                <span className="budget-sub-stat-label">使用額</span>
                <strong className="budget-sub-stat-value">
                  {formatCurrency(snapshot.totalSpent)}
                </strong>
              </div>
              <div className="budget-sub-stat">
                <span className="budget-sub-stat-label">進捗率</span>
                <strong className="budget-sub-stat-value">
                  {snapshot.totalUsageRate != null
                    ? `${Math.round(snapshot.totalUsageRate * 100)}%`
                    : "0%"}
                </strong>
              </div>
            </div>

            <div className="budget-progress-shell" aria-label="予算進捗バー">
              <div
                className={`budget-progress ${
                  snapshot.totalRemaining != null && snapshot.totalRemaining < 0
                    ? "budget-progress-over"
                    : "budget-progress-used"
                }`}
                style={{
                  width: `${
                    snapshot.totalRemaining != null &&
                    snapshot.totalRemaining < 0
                      ? 100
                      : progressRate * 100
                  }%`,
                }}
              />
              {snapshot.totalRemaining != null &&
              snapshot.totalRemaining >= 0 ? (
                <div
                  className="budget-progress budget-progress-remaining"
                  style={{ width: `${Math.max(0, 100 - progressRate * 100)}%` }}
                />
              ) : null}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <p className="section-title">予算が未設定です</p>
            <p className="section-copy">
              予算設定から全体予算とカテゴリ別予算を保存できます。
            </p>
          </div>
        )}
      </section>

      <SectionCard
        title="カテゴリ別予算"
        description={
          snapshot.tracksSelectedCategories
            ? undefined
            : "カテゴリ別予算は未設定のため、今月支出があるカテゴリを表示しています。"
        }
      >
        <div className="section-card-header-row section-card-header-row-inline">
          <div />
          <Link
            className="button button-secondary compact-button action-button action-button-secondary"
            href="/home/budget"
          >
            編集
          </Link>
        </div>
        <div style={{ height: 12 }} />
        {snapshot.categoryItems.length === 0 ? (
          <div className="empty-state">
            <p className="section-title">カテゴリ別予算はまだありません</p>
            <p className="section-copy">
              予算設定からカテゴリ別予算を追加できます。
            </p>
          </div>
        ) : (
          <div className="list">
            {snapshot.categoryItems.map((item) => {
              const rate = clampRate(item.usageRate);

              return (
                <div className="list-row list-row-budget" key={item.categoryId}>
                  <div className="budget-detail-row-main">
                    <div>
                      <p className="list-title">{item.categoryName}</p>
                      <p className="list-meta">
                        予算 {formatCurrency(item.budgetAmount)} / 使用{" "}
                        {formatCurrency(item.spentAmount)}
                      </p>
                    </div>
                    <div className="budget-detail-row-side">
                      <strong>{formatCurrency(item.remainingAmount)}</strong>
                      <span className="list-meta">
                        {item.usageRate != null
                          ? `${Math.round(item.usageRate * 100)}%`
                          : "予算なし"}
                      </span>
                    </div>
                  </div>

                  <div
                    className="budget-progress-shell budget-progress-shell-inline"
                    aria-hidden="true"
                  >
                    <div
                      className={`budget-progress ${
                        item.isOverBudget
                          ? "budget-progress-over"
                          : "budget-progress-used"
                      }`}
                      style={{
                        width: `${item.isOverBudget ? 100 : rate * 100}%`,
                      }}
                    />
                    {!item.isOverBudget ? (
                      <div
                        className="budget-progress budget-progress-remaining"
                        style={{ width: `${Math.max(0, 100 - rate * 100)}%` }}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <div className="single-action-row">
        <BackButton
          className="button button-secondary compact-button action-button action-button-secondary bottom-back-button"
          fallbackHref="/app?tab=home"
        />
      </div>
    </div>
  );
}
