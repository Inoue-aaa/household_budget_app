import Link from "next/link";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { DailySpendingChart } from "@/features/expenses/DailySpendingChart";
import { getExpensesReportSnapshot } from "@/lib/finance/queries";
import { formatCurrency } from "@/lib/utils/format";

type ExpensesReportPageProps = {
  searchParams?: Promise<{
    month?: string;
  }>;
};

export default async function ExpensesReportPage({
  searchParams,
}: ExpensesReportPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const snapshot = await getExpensesReportSnapshot(params?.month);

  return (
    <div className="page-stack">
      <ScreenHeader
        eyebrow="Reports"
        title="支出レポート"
        description="月ごとの推移と、日別の支出を見返せます。日別詳細から個別の修正にも進めます。"
      />

      <SectionCard
        title="表示月"
        description="年月を切り替えると、その月の日別支出と合計金額を確認できます。"
      >
        <form className="field-stack" method="get">
          <div className="field">
            <label htmlFor="month">年月</label>
            <select defaultValue={snapshot.targetMonth} id="month" name="month">
              {snapshot.availableMonths.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
          <button className="button button-secondary" type="submit">
            この月を表示
          </button>
        </form>
      </SectionCard>

      <section className="stats-grid stats-grid-single">
        <div className="surface stat-card stat-card-accent stat-card-wide">
          <span className="stat-label">{snapshot.monthLabel}の合計金額</span>
          <strong className="stat-value">
            {formatCurrency(snapshot.totalAmount)}
          </strong>
        </div>
      </section>

      <SectionCard
        title={`${snapshot.monthLabel}の日別支出`}
        description="行全体をタップすると、その日の詳細画面に移動します。支出がない日も選択できます。"
      >
        <DailySpendingChart
          items={snapshot.dailySpending}
          linkBasePath="/expenses/day"
          monthLabel={snapshot.monthLabel}
        />
      </SectionCard>

      <div className="single-action-row">
        <Link
          className="button button-secondary compact-button action-button action-button-secondary bottom-back-button"
          href="/expenses"
        >
          back
        </Link>
      </div>
    </div>
  );
}
