import Link from "next/link";
import { NoticeBanner } from "@/components/NoticeBanner";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { ExpenseEditForm } from "@/features/expenses/ExpenseEditForm";
import { getDailyExpensesSnapshot } from "@/lib/finance/queries";
import {
  formatCurrency,
  formatDisplayDate,
  formatSourceLabel,
} from "@/lib/utils/format";

type DailyExpensesPageProps = {
  params: Promise<{
    date: string;
  }>;
  searchParams?: Promise<{
    notice?: string;
  }>;
};

function addDays(date: string, diff: number) {
  const base = new Date(`${date}T00:00:00`);
  base.setDate(base.getDate() + diff);
  return base.toISOString().slice(0, 10);
}

function getDailyNotice(code?: string) {
  switch (code) {
    case "expense_updated":
      return {
        tone: "success" as const,
        title: "明細を更新しました",
        description:
          "その日の合計金額とカテゴリ別小計を最新の内容に反映しました。",
      };
    case "expense_amount_updated":
      return {
        tone: "success" as const,
        title: "金額を更新しました",
        description: "明細の金額を反映しました。",
      };
    case "expense_deleted":
      return {
        tone: "success" as const,
        title: "明細を削除しました",
        description: "その日の集計結果もあわせて更新しました。",
      };
    case "expense_update_error":
      return {
        title: "明細を更新できませんでした",
        description: "入力内容を見直して、もう一度お試しください。",
      };
    case "expense_amount_error":
      return {
        title: "金額を更新できませんでした",
        description: "金額は1円以上の整数で入力してください。",
      };
    case "expense_delete_error":
      return {
        title: "明細を削除できませんでした",
        description: "時間をおいて、もう一度お試しください。",
      };
    default:
      return null;
  }
}

export default async function DailyExpensesPage({
  params,
  searchParams,
}: DailyExpensesPageProps) {
  const { date } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const snapshot = await getDailyExpensesSnapshot(date);
  const notice = getDailyNotice(resolvedSearchParams?.notice);

  if (!snapshot) {
    return (
      <div className="page-stack">
        <ScreenHeader
          eyebrow="Day"
          title="日別詳細"
          description="日付の形式が正しくないため、この画面を表示できませんでした。"
        />

        <SectionCard
          title="表示できませんでした"
          description="URL の日付を見直してから、もう一度開いてください。"
        >
          <div className="single-action-row">
            <Link
              className="button button-secondary compact-button action-button action-button-secondary bottom-back-button"
              href="/expenses/reports"
            >
              back
            </Link>
          </div>
        </SectionCard>
      </div>
    );
  }

  const previousDate = addDays(snapshot.date, -1);
  const nextDate = addDays(snapshot.date, 1);

  return (
    <div className="page-stack">
      {notice ? (
        <NoticeBanner
          description={notice.description}
          title={notice.title}
          tone={notice.tone}
        />
      ) : null}

      <ScreenHeader
        eyebrow="Day"
        title={formatDisplayDate(snapshot.date)}
        description="その日の保存済み支出を見直しながら、金額やカテゴリを調整できます。"
      />

      <div className="day-nav-grid">
        <Link
          className="button button-secondary compact-button action-button action-button-secondary"
          href={`/expenses/day/${previousDate}`}
        >
          前の日へ
        </Link>
        <Link
          className="button button-secondary compact-button action-button action-button-secondary"
          href={`/expenses/day/${nextDate}`}
        >
          次の日へ
        </Link>
      </div>

      <section className="stats-grid stats-grid-single">
        <div className="surface stat-card stat-card-accent stat-card-wide">
          <span className="stat-label">合計金額</span>
          <strong className="stat-value">
            {formatCurrency(snapshot.totalAmount)}
          </strong>
        </div>
      </section>

      <SectionCard
        title="カテゴリ別小計"
        description="その日にどのカテゴリへいくら使ったかをまとめています。"
      >
        <div className="list">
          {snapshot.categorySummary.length === 0 ? (
            <p className="section-copy">
              この日はカテゴリ別小計がまだありません。
            </p>
          ) : (
            snapshot.categorySummary.map((item) => (
              <div
                className="list-row"
                key={item.categoryId ?? item.categoryName}
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

      <SectionCard
        title="支出明細"
        description="金額とカテゴリを調整できます。不要な明細はここから削除できます。"
      >
        <div className="list">
          {snapshot.items.length === 0 ? (
            <div className="empty-state">
              <p className="section-title">この日の支出はまだありません</p>
              <p className="section-copy">
                新規追加から、手入力登録へ進めます。
              </p>
            </div>
          ) : (
            snapshot.items.map((item) => (
              <section className="expense-card" key={item.id}>
                <div className="expense-card-main">
                  <div className="expense-card-header">
                    <div>
                      <p className="list-title">{item.title}</p>
                      <p className="list-meta">
                        {item.merchantName ? `${item.merchantName} ・ ` : ""}
                        {item.categoryName} ・{" "}
                        {formatSourceLabel(item.sourceType)}
                        {item.note ? ` ・ ${item.note}` : ""}
                      </p>
                    </div>
                    <strong className="expense-amount">
                      {formatCurrency(item.amount)}
                    </strong>
                  </div>

                  <ExpenseEditForm
                    categories={snapshot.categories}
                    expense={item}
                  />
                </div>
              </section>
            ))
          )}
        </div>

        <div className="section-card-footer section-card-footer-centered">
          <Link
            className="button button-secondary compact-button action-button action-button-secondary day-secondary-action"
            href={`/register/manual?occurredOn=${snapshot.date}`}
          >
            新規追加
          </Link>
        </div>
      </SectionCard>

      <div className="single-action-row">
        <Link
          className="button button-secondary compact-button action-button action-button-secondary bottom-back-button"
          href={`/expenses/reports?month=${snapshot.date.slice(0, 7)}`}
        >
          back
        </Link>
      </div>
    </div>
  );
}
