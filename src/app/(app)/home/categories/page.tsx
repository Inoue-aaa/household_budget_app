import Link from "next/link";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { getCategoryBreakdownSnapshot } from "@/lib/finance/queries";
import { formatCurrency } from "@/lib/utils/format";

type CategoryBreakdownPageProps = {
  searchParams?: Promise<{
    month?: string;
    category?: string;
  }>;
};

export default async function CategoryBreakdownPage({
  searchParams
}: CategoryBreakdownPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const snapshot = await getCategoryBreakdownSnapshot(params?.month, params?.category ?? null);

  return (
    <div className="page-stack">
      <ScreenHeader
        eyebrow="Categories"
        title="カテゴリ別支出"
        description="指定月のカテゴリ別支出を金額の大きい順で表示します。ホームでは上位3件だけを表示しています。"
      />

      <SectionCard
        title="表示月"
        description="年月を切り替えると、その月のカテゴリ別支出を見直せます。"
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
          <span className="stat-label">{snapshot.monthLabel}のカテゴリ別合計</span>
          <strong className="stat-value">{formatCurrency(snapshot.totalAmount)}</strong>
        </div>
      </section>

      <SectionCard
        title={`${snapshot.monthLabel}のカテゴリ一覧`}
        description="支出が大きい順で並べています。ホームから来たカテゴリは少し目立つ表示になります。"
      >
        <div className="list">
          {snapshot.items.length === 0 ? (
            <div className="empty-state">
              <p className="section-title">この月のカテゴリ別支出はまだありません</p>
              <p className="section-copy">保存済みの支出が増えると、ここにカテゴリ別の一覧が表示されます。</p>
            </div>
          ) : (
            snapshot.items.map((item) => (
              <div
                className="list-row"
                data-highlight={snapshot.selectedCategoryId === item.categoryId}
                key={item.categoryId}
              >
                <div>
                  <p className="list-title">{item.categoryName}</p>
                  <p className="list-meta">{item.count}件</p>
                </div>
                <strong>{formatCurrency(item.total)}</strong>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      <Link className="button button-secondary compact-button bottom-back-button" href="/home">
        back
      </Link>
    </div>
  );
}
