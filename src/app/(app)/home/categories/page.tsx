import Link from "next/link";
import type { Route } from "next";
import { BackButton } from "@/components/BackButton";
import { MonthYearPickerFields } from "@/components/MonthYearPickerFields";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { ExpenseDeleteForm } from "@/features/expenses/ExpenseDeleteForm";
import { getCategoryBreakdownSnapshot } from "@/lib/finance/queries";
import { formatCurrency, formatDisplayDate, resolveSearchMonth } from "@/lib/utils/format";

type CategoryBreakdownPageProps = {
  searchParams?: Promise<{
    month?: string;
    year?: string;
    monthNumber?: string;
    category?: string;
    sort?: string;
  }>;
};

function resolveSort(
  value?: string
): "date_desc" | "date_asc" | "amount_desc" | "amount_asc" {
  if (
    value === "date_desc" ||
    value === "date_asc" ||
    value === "amount_desc" ||
    value === "amount_asc"
  ) {
    return value;
  }

  return "date_desc";
}

export default async function CategoryBreakdownPage({
  searchParams,
}: CategoryBreakdownPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const selectedSort = resolveSort(params?.sort);
  const snapshot = await getCategoryBreakdownSnapshot(
    resolveSearchMonth(params),
    params?.category ?? null,
    selectedSort
  );

  return (
    <div className="page-stack">
      <ScreenHeader eyebrow="Categories" title="カテゴリ別支出" description="" />

      <SectionCard title="表示月">
        <form className="field-stack" method="get">
          <MonthYearPickerFields
            availableMonths={snapshot.availableMonths}
            targetMonth={snapshot.targetMonth}
          />
          {snapshot.selectedCategoryId ? (
            <input name="category" type="hidden" value={snapshot.selectedCategoryId} />
          ) : null}
          <input name="sort" type="hidden" value={snapshot.selectedSort} />
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

      <SectionCard title={`${snapshot.monthLabel}のカテゴリ一覧`}>
        <div className="list">
          {snapshot.items.length === 0 ? (
            <div className="empty-state">
              <p className="section-title">この月のカテゴリ別支出はまだありません</p>
              <p className="section-copy">
                登録済みの支出が増えると、ここにカテゴリごとの集計が表示されます。
              </p>
            </div>
          ) : (
            snapshot.items.map((item) => {
              const href = `/home/categories?month=${snapshot.targetMonth}&category=${item.categoryId}&sort=${snapshot.selectedSort}` as Route;

              return (
                <Link
                  className="list-row list-row-link"
                  data-highlight={snapshot.selectedCategoryId === item.categoryId}
                  href={href}
                  key={item.categoryId}
                >
                  <div>
                    <p className="list-title">{item.categoryName}</p>
                    <p className="list-meta">{item.count}件</p>
                  </div>
                  <strong>{formatCurrency(item.total)}</strong>
                </Link>
              );
            })
          )}
        </div>
      </SectionCard>

      {snapshot.selectedCategoryId ? (
        <SectionCard title={`${snapshot.monthLabel}の${snapshot.selectedCategoryName}一覧`}>
          <form className="field-stack category-sort-form" method="get">
            <input name="month" type="hidden" value={snapshot.targetMonth} />
            <input name="category" type="hidden" value={snapshot.selectedCategoryId} />
            <div className="field">
              <label htmlFor="sort">並び順</label>
              <select defaultValue={snapshot.selectedSort} id="sort" name="sort">
                <option value="amount_desc">金額が高い順</option>
                <option value="amount_asc">金額が低い順</option>
                <option value="date_desc">新しい順</option>
                <option value="date_asc">古い順</option>
              </select>
            </div>
            <div className="single-action-row category-sort-submit-row">
              <button
                className="button button-secondary compact-button action-button action-button-secondary"
                type="submit"
              >
                並び替える
              </button>
            </div>
          </form>

          <div className="list">
            {snapshot.selectedExpenses.length === 0 ? (
              <div className="empty-state">
                <p className="section-title">このカテゴリの明細はありません</p>
                <p className="section-copy">
                  条件に合う支出があると、ここに品目一覧が表示されます。
                </p>
              </div>
            ) : (
              snapshot.selectedExpenses.map((expense) => {
                const returnTo = `/home/categories?month=${snapshot.targetMonth}&category=${snapshot.selectedCategoryId}&sort=${snapshot.selectedSort}`;
                const editHref = `/expenses/day/${expense.occurredOn}` as Route;

                return (
                  <section className="expense-card" key={expense.id}>
                    <div className="expense-card-main">
                      <div className="expense-card-header">
                        <div>
                          <p className="list-title">{expense.title}</p>
                          <p className="list-meta">
                            {expense.merchantName ? `${expense.merchantName} ・ ` : ""}
                            {formatDisplayDate(expense.occurredOn)} ・ {expense.categoryName}
                            {expense.note ? ` ・ ${expense.note}` : ""}
                          </p>
                        </div>
                        <strong className="expense-amount">
                          {formatCurrency(expense.amount)}
                        </strong>
                      </div>

                      <div className="action-button-row action-button-row-centered expense-card-action-row">
                        <ExpenseDeleteForm
                          expenseId={expense.id}
                          occurredOn={expense.occurredOn}
                          returnTo={returnTo}
                          title={expense.title}
                        />
                        <Link
                          className="button compact-button action-button action-button-primary"
                          href={editHref}
                        >
                          修正
                        </Link>
                      </div>
                    </div>
                  </section>
                );
              })
            )}
          </div>
        </SectionCard>
      ) : null}

      <div className="single-action-row">
        <BackButton
          className="button button-secondary compact-button action-button action-button-secondary bottom-back-button"
          fallbackHref="/home"
        />
      </div>
    </div>
  );
}
