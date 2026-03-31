import type { CSSProperties } from "react";
import Link from "next/link";
import { Circle, MessageSquareText, Settings2 } from "lucide-react";
import { NoticeBanner } from "@/components/NoticeBanner";
import { SectionCard } from "@/components/SectionCard";
import { BudgetProgressCard } from "@/features/monthly-budget/BudgetProgressCard";
import type { DashboardSnapshot } from "@/lib/finance/types";
import { formatCurrency, formatMonthLabel } from "@/lib/utils/format";

type HomeTabPanelProps = {
  snapshot: DashboardSnapshot;
  noticeCode?: string;
};

function getHomeNotice(code?: string) {
  if (code !== "budget_saved") {
    return null;
  }

  return {
    tone: "success" as const,
    title: "予算設定を保存しました",
    description: "ホームの進捗カードに最新の予算を反映しました。",
  };
}

const CATEGORY_ROW_ACCENTS = ["#6f9cf0", "#8bc7a6", "#d49bc0"] as const;

export function HomeTabPanel({ snapshot, noticeCode }: HomeTabPanelProps) {
  const notice = getHomeNotice(noticeCode);
  const currentMonth = formatMonthLabel(snapshot.budget.targetMonth);

  return (
    <div className="page-stack tab-panel-stack">
      {notice ? (
        <NoticeBanner
          description={notice.description}
          title={notice.title}
          tone={notice.tone}
        />
      ) : null}

      <div className="home-hero-stack">
        <BudgetProgressCard budget={snapshot.budget} />

        <section className="surface home-monthly-inline">
          <div>
            <span className="stat-label">{currentMonth}の支出合計</span>
            <p className="home-monthly-inline-copy">
              保存済みの支出だけを集計しています。
            </p>
          </div>
          <strong className="home-monthly-inline-value">
            {formatCurrency(snapshot.monthlyTotal)}
          </strong>
        </section>
      </div>

      <SectionCard title="カテゴリ別支出">
        <div className="list">
          {snapshot.categorySummary.length === 0 ? (
            <div className="empty-state">
              <p className="section-title">今月のカテゴリ別支出はまだありません</p>
              <p className="section-copy">
                支出を登録すると、ここにカテゴリごとの集計が表示されます。
              </p>
            </div>
          ) : (
            <>
              {snapshot.categorySummary.map((item, index) => (
                <Link
                  className="list-row list-row-link home-category-row"
                  href={`/home/categories?month=${snapshot.budget.targetMonth.slice(0, 7)}&category=${item.categoryId}`}
                  key={item.categoryId}
                >
                  <div className="home-category-meta">
                    <span
                      aria-hidden="true"
                      className="home-category-dot"
                      style={
                        {
                          "--home-category-accent":
                            CATEGORY_ROW_ACCENTS[index % CATEGORY_ROW_ACCENTS.length],
                        } as CSSProperties
                      }
                    >
                      <Circle size={10} fill="currentColor" strokeWidth={0} />
                    </span>
                    <div>
                      <p className="list-title">{item.categoryName}</p>
                      <p className="list-meta">{item.count}件</p>
                    </div>
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

      <Link
        className="surface section-card section-card-link home-quick-action"
        href="/expenses/ai"
      >
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

      <Link
        className="surface section-card section-card-link home-quick-action"
        href="/home/budget"
      >
        <div className="section-card-link-header">
          <div className="home-quick-action-title">
            <span className="home-quick-action-icon" aria-hidden="true">
              <Settings2 size={17} />
            </span>
            <h2 className="section-title">予算設定</h2>
          </div>
          <span className="section-card-link-arrow" aria-hidden="true">
            ›
          </span>
        </div>
        <p className="section-copy">
          {snapshot.budget.hasBudget
            ? "今月の予算額と対象カテゴリを見直せます。固定費を予算対象から外したいときにも使えます。"
            : "今月の予算額と対象カテゴリを設定できます。まずは変動費だけを対象にすると始めやすいです。"}
        </p>
      </Link>
    </div>
  );
}
