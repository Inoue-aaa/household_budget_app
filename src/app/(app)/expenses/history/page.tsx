import Link from "next/link";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { getExpenseHistorySnapshot } from "@/lib/finance/queries";
import { formatCurrency, formatDisplayDate } from "@/lib/utils/format";

type ExpenseHistoryPageProps = {
  searchParams?: Promise<{
    month?: string;
  }>;
};

export default async function ExpenseHistoryPage({ searchParams }: ExpenseHistoryPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const snapshot = await getExpenseHistorySnapshot(params?.month);

  return (
    <div className="page-stack">
      <ScreenHeader
        eyebrow="History"
        title="登録履歴"
        description="保存済み支出を日ごとに振り返る画面です。対象日を選ぶと、その日の詳細内訳へ進めます。"
      />

      <SectionCard
        title="表示月"
        description="年月を切り替えると、その月の登録履歴を日ごとに確認できます。"
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

      <section className="stats-grid">
        <div className="surface stat-card stat-card-accent">
          <span className="stat-label">表示件数</span>
          <strong className="stat-value">{snapshot.totalCount}件</strong>
        </div>
        <div className="surface stat-card">
          <span className="stat-label">表示合計</span>
          <strong className="stat-value">{formatCurrency(snapshot.totalAmount)}</strong>
        </div>
      </section>

      <SectionCard
        title={`${snapshot.monthLabel}の日別一覧`}
        description="対象日を押すと、その日の合計金額と支出明細を確認できます。"
      >
        <div className="list">
          {snapshot.days.length === 0 ? (
            <div className="empty-state">
              <p className="section-title">この月の登録履歴はまだありません</p>
              <p className="section-copy">
                保存済み支出が増えると、ここに日別の一覧が表示されます。
              </p>
            </div>
          ) : (
            snapshot.days.map((day) => (
              <Link className="list-row list-row-link" href={`/expenses/day/${day.date}`} key={day.date}>
                <div>
                  <p className="list-title">{formatDisplayDate(day.date)}</p>
                  <p className="list-meta">{day.count}件</p>
                </div>
                <strong>{formatCurrency(day.totalAmount)}</strong>
              </Link>
            ))
          )}
        </div>
      </SectionCard>

      <Link className="button button-secondary compact-button bottom-back-button" href="/expenses">
        back
      </Link>
    </div>
  );
}
