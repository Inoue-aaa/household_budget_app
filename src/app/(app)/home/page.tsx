import Link from "next/link";
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
    description: "ホームの予算進捗カードに最新の設定を反映しました。"
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
          <p className="section-copy stat-support-copy">
            保存済みの支出だけを対象に、今月の合計額を表示しています。
          </p>
        </div>
      </section>

      <SectionCard
        title="カテゴリ別サマリー"
        description="今月の支出が大きいカテゴリを上位3件まで表示しています。すべての内訳は詳細画面で確認できます。"
      >
        <div className="list">
          {snapshot.categorySummary.length === 0 ? (
            <div className="empty-state">
              <p className="section-title">今月のカテゴリ別支出はまだありません</p>
              <p className="section-copy">
                手入力や読み取り結果の確定保存を行うと、ここに今月のカテゴリ別サマリーが表示されます。
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
                className="link-card"
                href={`/home/categories?month=${snapshot.budget.targetMonth.slice(0, 7)}`}
              >
                <strong>カテゴリ別詳細を見る</strong>
                <span>{currentMonth}のカテゴリ別支出を金額順で確認できます。</span>
              </Link>
            </>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="予算設定"
        description="ホーム上の予算カードには編集ボタンを置かず、ここから今月の予算額と対象カテゴリを調整できるようにしています。"
      >
        <Link className="link-card link-card-featured" href="/home/budget">
          <strong>{snapshot.budget.hasBudget ? "今月の予算を見直す" : "今月の予算を設定する"}</strong>
          <span>
            総予算額と集計対象カテゴリをまとめて更新できます。変動費だけを予算管理したいときに使えます。
          </span>
        </Link>
      </SectionCard>
    </div>
  );
}
