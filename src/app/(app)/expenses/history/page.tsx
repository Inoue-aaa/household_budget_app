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

export default async function ExpenseHistoryPage({
  searchParams,
}: ExpenseHistoryPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const snapshot = await getExpenseHistorySnapshot(params?.month);

  return (
    <div className="page-stack">
      <ScreenHeader
        eyebrow="History"
        title="登録履歴"
        description="保存済み支出を日ごとに振り返る画面です。対象日を選ぶと、その日の詳細へ移動できます。"
      />

      <SectionCard
        title="表示月"
        description="月を切り替えると、その月の登録履歴を日別に確認できます。"
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
          <div className="single-action-row">
            <button
              className="button button-secondary compact-button action-button action-button-secondary"
              type="submit"
            >
              この月を表示
            </button>
          </div>
        </form>
      </SectionCard>

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

      <SectionCard
        title={`${snapshot.monthLabel}の日別一覧`}
        description="対象月の日ごとの合計金額と件数を一覧で確認できます。"
      >
        <div className="list">
          {snapshot.days.length === 0 ? (
            <div className="empty-state">
              <p className="section-title">この月の登録履歴はありません</p>
              <p className="section-copy">
                保存済み支出が増えると、ここに日別一覧として表示されます。
              </p>
            </div>
          ) : (
            snapshot.days.map((day) => (
              <Link
                className="list-row list-row-link"
                href={`/expenses/day/${day.date}`}
                key={day.date}
              >
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
