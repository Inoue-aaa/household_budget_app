import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { NoticeBanner } from "@/components/NoticeBanner";
import { SectionCard } from "@/components/SectionCard";
import { BudgetProgressCard } from "@/features/monthly-budget/BudgetProgressCard";
import { getDashboardSnapshot } from "@/lib/finance/queries";
import { formatCurrency, formatMonthLabel } from "@/lib/utils/format";

function getHomeNotice(code?: string) {
  if (code !== "budget_saved") {
    return null;
  }

  return {
    tone: "success" as const,
    title: "予算設定を保存しました",
    description: "ホームの予算カードに最新の設定を反映しました。"
  };
}

type HomePageProps = {
  searchParams?: Promise<{
    notice?: string;
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const snapshot = await getDashboardSnapshot();
  const params = searchParams ? await searchParams : undefined;
  const notice = getHomeNotice(params?.notice);
  const currentMonth = formatMonthLabel(snapshot.budget.targetMonth);

  return (
    <div className="page-stack">
      {notice ? (
        <NoticeBanner
          description={notice.description}
          title={notice.title}
          tone={notice.tone}
        />
      ) : null}

      <BudgetProgressCard budget={snapshot.budget} />

      <section className="stats-grid stats-grid-single">
        <div className="surface stat-card stat-card-accent stat-card-wide">
          <span className="stat-label">{currentMonth}の支出合計</span>
          <strong className="stat-value">{formatCurrency(snapshot.monthlyTotal)}</strong>
        </div>
      </section>

      <SectionCard
        title="カテゴリ別支出"
        description="今月の支出が大きいカテゴリを上位3件まで表示しています。"
      >
        <div className="list">
          {snapshot.categorySummary.length === 0 ? (
            <div className="empty-state">
              <p className="section-title">今月のカテゴリ別支出はまだありません</p>
              <p className="section-copy">
                手入力やレシート review を保存すると、ここにカテゴリ別支出が表示されます。
              </p>
            </div>
          ) : (
            <>
              {snapshot.categorySummary.map((item) => (
                <Link
                  className="list-row list-row-link"
                  href={`/home/categories?month=${snapshot.budget.targetMonth.slice(0, 7)}&category=${item.categoryId}`}
                  key={item.categoryId}
                >
                  <div>
                    <p className="list-title">{item.categoryName}</p>
                    <p className="list-meta">{item.count}件</p>
                  </div>
                  <strong>{formatCurrency(item.total)}</strong>
                </Link>
              ))}
              <Link
                className="list-row list-row-link"
                href={`/home/categories?month=${snapshot.budget.targetMonth.slice(0, 7)}`}
              >
                <div>
                  <p className="list-title">カテゴリ別詳細</p>
                </div>
                <strong>›</strong>
              </Link>
            </>
          )}
        </div>
      </SectionCard>

      <Link className="surface section-card section-card-link" href="/home/budget">
        <div className="section-card-link-header">
          <h2 className="section-title">予算設定</h2>
          <span className="section-card-link-arrow" aria-hidden="true">
            ›
          </span>
        </div>
        <p className="section-copy">
          {snapshot.budget.hasBudget
            ? "今月の予算額と対象カテゴリを見直せます。固定費を予算対象から外したいときにも使えます。"
            : "今月の予算額と対象カテゴリを設定します。まずは変動費だけを選んで始められます。"}
        </p>
      </Link>

      <Link className="surface section-card section-card-link home-quick-action" href="/expenses/ai">
        <div className="section-card-link-header">
          <div className="home-quick-action-title">
            <span className="home-quick-action-icon" aria-hidden="true">
              <MessageSquareText size={17} />
            </span>
            <h2 className="section-title">AI相談</h2>
          </div>
          <span className="section-card-link-arrow" aria-hidden="true">
            ›
          </span>
        </div>
        <p className="section-copy">
          指定期間の集計データをもとに、支出の傾向や見直しポイントを相談できます。
        </p>
      </Link>
    </div>
  );
}
