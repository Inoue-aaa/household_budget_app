import { BackButton } from "@/components/BackButton";
import { MonthYearPickerFields } from "@/components/MonthYearPickerFields";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { DailySpendingChart } from "@/features/expenses/DailySpendingChart";
import { getExpensesReportSnapshot } from "@/lib/finance/queries";
import { formatCurrency, resolveSearchMonth } from "@/lib/utils/format";

type ExpensesReportPageProps = {
  searchParams?: Promise<{
    month?: string;
    year?: string;
    monthNumber?: string;
  }>;
};

export default async function ExpensesReportPage({
  searchParams,
}: ExpensesReportPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const snapshot = await getExpensesReportSnapshot(resolveSearchMonth(params));

  return (
    <div className="page-stack">
      <ScreenHeader
        eyebrow="Reports"
        title="日次レポート"
        description="表示月の日別支出を確認できます。各日から詳細へ進み、個別の修正も行えます。"
      />

      <SectionCard
        title="表示月"
        description="年月を切り替えて、その月の日別支出を確認できます。"
      >
        <form className="field-stack" method="get">
          <MonthYearPickerFields
            availableMonths={snapshot.availableMonths}
            targetMonth={snapshot.targetMonth}
          />
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
        description="日ごとの支出を確認できます。各日から詳細画面へ移動できます。"
      >
        <DailySpendingChart
          items={snapshot.dailySpending}
          linkBasePath="/expenses/day"
          monthLabel={snapshot.monthLabel}
        />
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
