import Link from "next/link";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { getYearlySpendingTrendSnapshot } from "@/lib/finance/queries";
import { formatCurrency } from "@/lib/utils/format";

type YearlyTrendPageProps = {
  searchParams?: Promise<{
    year?: string;
    month?: string;
  }>;
};

export default async function YearlyTrendPage({
  searchParams,
}: YearlyTrendPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const snapshot = await getYearlySpendingTrendSnapshot(params?.year);
  const returnMonth =
    params?.month && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : `${snapshot.targetYear}-01`;
  const maxAmount = snapshot.items.reduce(
    (currentMax, item) => Math.max(currentMax, item.totalAmount),
    0
  );

  return (
    <div className="page-stack">
      <ScreenHeader
        eyebrow="Summary"
        title="年次推移"
        description={`${snapshot.targetYear}年の月ごとの支出推移を確認できます。`}
      />

      <SectionCard title="表示年">
        <form className="field-stack" method="get">
          <input name="month" type="hidden" value={returnMonth} />
          <div className="field">
            <label htmlFor="year">年</label>
            <select defaultValue={snapshot.targetYear} id="year" name="year">
              {snapshot.availableYears.map((year) => (
                <option key={year.value} value={year.value}>
                  {year.label}
                </option>
              ))}
            </select>
          </div>
          <button className="button button-secondary" type="submit">
            この年を表示
          </button>
        </form>
      </SectionCard>

      <section className="stats-grid stats-grid-single">
        <div className="surface stat-card stat-card-accent stat-card-wide">
          <span className="stat-label">{snapshot.targetYear}年の総支出</span>
          <strong className="stat-value">{formatCurrency(snapshot.totalAmount)}</strong>
        </div>
      </section>

      <SectionCard title={`${snapshot.targetYear}年の支出推移`}>
        <div className="trend-chart">
          {snapshot.items.map((item) => {
            const ratio = maxAmount > 0 ? item.totalAmount / maxAmount : 0;
            const width = Math.max(ratio * 100, item.totalAmount > 0 ? 8 : 0);

            return (
              <div className="trend-chart-row" key={item.month}>
                <div className="trend-chart-label">{item.monthLabel}</div>
                <div className="trend-chart-track">
                  <div
                    className="trend-chart-bar"
                    data-empty={item.totalAmount === 0}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <div className="trend-chart-amount">{formatCurrency(item.totalAmount)}</div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <div className="single-action-row">
        <Link
          className="button button-secondary compact-button action-button action-button-secondary bottom-back-button"
          href={`/expenses/summary?month=${returnMonth}`}
        >
          back
        </Link>
      </div>
    </div>
  );
}
