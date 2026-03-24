import Link from "next/link";
import { NoticeBanner } from "@/components/NoticeBanner";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { ExpenseCategoryUpdateForm } from "@/features/expenses/ExpenseCategoryUpdateForm";
import { ExpenseDeleteForm } from "@/features/expenses/ExpenseDeleteForm";
import { getDailyExpensesSnapshot } from "@/lib/finance/queries";
import { formatCurrency, formatDisplayDate, formatSourceLabel } from "@/lib/utils/format";

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
        title: "カテゴリを更新しました",
        description: "この日の集計と明細に変更を反映しました。"
      };
    case "expense_deleted":
      return {
        tone: "success" as const,
        title: "明細を削除しました",
        description: "この日の合計金額とカテゴリ別小計を更新しました。"
      };
    case "expense_update_error":
      return {
        title: "カテゴリを更新できませんでした",
        description: "時間をおいてもう一度お試しください。"
      };
    case "expense_delete_error":
      return {
        title: "明細を削除できませんでした",
        description: "時間をおいてもう一度お試しください。"
      };
    default:
      return null;
  }
}

export default async function DailyExpensesPage({
  params,
  searchParams
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
          description="指定された日付を読み込めませんでした。URL の日付形式やデータの有無をご確認ください。"
        />

        <SectionCard title="表示できませんでした" description="日付の形式が正しくないか、読み込みに失敗しました。">
          <Link className="button button-secondary compact-button" href="/expenses/reports">
            back
          </Link>
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
        description="その日の合計金額、カテゴリ別小計、保存済み明細をまとめて確認できます。"
      />

      <section className="stats-grid stats-grid-single">
        <div className="surface stat-card stat-card-accent stat-card-wide">
          <span className="stat-label">その日の合計金額</span>
          <strong className="stat-value">{formatCurrency(snapshot.totalAmount)}</strong>
        </div>
      </section>

      <section className="surface section-card">
        <div className="day-action-grid">
          <Link className="button button-secondary compact-button" href={`/register/manual?occurredOn=${snapshot.date}`}>
            新規追加
          </Link>
          <Link className="button button-secondary compact-button" href={`/expenses/day/${previousDate}`}>
            前日へ
          </Link>
          <Link className="button button-secondary compact-button" href={`/expenses/day/${nextDate}`}>
            次の日へ
          </Link>
        </div>
      </section>

      <SectionCard
        title="カテゴリ別小計"
        description="その日にどのカテゴリへどれだけ使ったかをまとめています。"
      >
        <div className="list">
          {snapshot.categorySummary.length === 0 ? (
            <p className="section-copy">この日のカテゴリ別小計はまだありません。</p>
          ) : (
            snapshot.categorySummary.map((item) => (
              <div className="list-row" key={item.categoryId ?? item.categoryName}>
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
        description="カテゴリ変更や削除は各明細ごとに行えます。変更後はこの日の集計へすぐ反映されます。"
      >
        <div className="list">
          {snapshot.items.length === 0 ? (
            <div className="empty-state">
              <p className="section-title">この日の支出はまだありません</p>
              <p className="section-copy">
                新規追加からこの日付を初期値にして、手入力登録へ進めます。
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
                        {item.categoryName} ・ {formatSourceLabel(item.sourceType)}
                        {item.note ? ` ・ ${item.note}` : ""}
                      </p>
                    </div>
                    <strong className="expense-amount">{formatCurrency(item.amount)}</strong>
                  </div>

                  <div className="expense-row-actions">
                    <ExpenseCategoryUpdateForm categories={snapshot.categories} expense={item} />
                    <ExpenseDeleteForm
                      expenseId={item.id}
                      occurredOn={snapshot.date}
                      title={item.title}
                    />
                  </div>
                </div>
              </section>
            ))
          )}
        </div>
      </SectionCard>

      <Link
        className="button button-secondary compact-button bottom-back-button"
        href={`/expenses/reports?month=${snapshot.date.slice(0, 7)}`}
      >
        back
      </Link>
    </div>
  );
}
