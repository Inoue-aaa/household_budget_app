import Link from "next/link";
import { NoticeBanner } from "@/components/NoticeBanner";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import {
  deleteRecurringExpenseAction,
  toggleRecurringExpenseActiveAction,
} from "@/features/fixed-expenses/actions";
import { getRecurringExpensesPageSnapshot } from "@/features/fixed-expenses/queries";
import { formatCurrency } from "@/lib/utils/format";

type FixedExpenseListPageProps = {
  searchParams?: Promise<{
    notice?: string;
  }>;
};

function getFixedExpenseNotice(code?: string) {
  switch (code) {
    case "fixed-expense-created":
      return {
        tone: "success" as const,
        title: "固定費を保存しました",
        description: "固定費 / サブスクを登録しました。",
      };
    case "fixed-expense-updated":
      return {
        tone: "success" as const,
        title: "固定費を更新しました",
        description: "登録内容を更新しました。",
      };
    case "fixed-expense-toggled":
      return {
        tone: "success" as const,
        title: "有効 / 無効を切り替えました",
        description: "固定費の状態を更新しました。",
      };
    case "fixed-expense-deleted":
      return {
        tone: "success" as const,
        title: "固定費を削除しました",
        description: "一覧から固定費 / サブスクを削除しました。",
      };
    case "fixed-expense-toggle-error":
      return {
        title: "状態の更新に失敗しました",
        description: "時間をおいてから、もう一度お試しください。",
      };
    case "fixed-expense-delete-error":
      return {
        title: "削除に失敗しました",
        description: "時間をおいてから、もう一度お試しください。",
      };
    default:
      return null;
  }
}

export default async function FixedExpenseListPage({
  searchParams,
}: FixedExpenseListPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const notice = getFixedExpenseNotice(params?.notice);
  const snapshot = await getRecurringExpensesPageSnapshot();

  if (!snapshot) {
    return null;
  }

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
        eyebrow="Recurring"
        title="固定費 / サブスク"
        description="登録済みの固定費 / サブスクを一覧で確認し、編集や有効 / 無効を切り替えできます。"
      />

      <SectionCard
        title="登録済みの固定費"
        description={`全${snapshot.totalCount}件 / 有効 ${snapshot.activeCount}件`}
      >
        {snapshot.items.length === 0 ? (
          <div className="empty-state">
            <p className="section-title">固定費はまだ登録されていません</p>
            <p className="section-copy">
              家賃やサブスクなど、毎月追加したい支出をここから登録できます。
            </p>
            <div style={{ height: 14 }} />
            <Link
              className="button action-button action-button-primary"
              href="/register/fixed"
            >
              固定費を追加
            </Link>
          </div>
        ) : (
          <div className="list">
            {snapshot.items.map((item) => (
              <section className="expense-card" key={item.id}>
                <div className="expense-card-main">
                  <div className="expense-card-overline">
                    <span className={`pill ${item.isActive ? "pill-accent" : ""}`}>
                      {item.isActive ? "有効" : "無効"}
                    </span>
                  </div>

                  <div className="expense-card-header">
                    <div>
                      <p className="list-title">{item.name}</p>
                      <p className="list-meta">
                        {item.categoryName} ・ 毎月{item.scheduleDay}日 {item.scheduleTime}
                      </p>
                    </div>
                    <strong className="expense-amount">{formatCurrency(item.amount)}</strong>
                  </div>

                  {item.memo ? (
                    <div className="expense-detail-list recurring-expense-detail-list">
                      <div className="list-row">
                        <div>
                          <p className="expense-summary-label">メモ</p>
                          <p className="list-meta">{item.memo}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="action-button-row action-button-row-centered expense-card-action-row recurring-expense-action-row">
                    <form action={toggleRecurringExpenseActiveAction}>
                      <input name="recurringExpenseId" type="hidden" value={item.id} />
                      <input
                        name="isActive"
                        type="hidden"
                        value={item.isActive ? "false" : "true"}
                      />
                      <button
                        className="button button-secondary compact-button action-button action-button-secondary"
                        type="submit"
                      >
                        {item.isActive ? "無効化" : "有効化"}
                      </button>
                    </form>

                    <form action={deleteRecurringExpenseAction}>
                      <input name="recurringExpenseId" type="hidden" value={item.id} />
                      <ConfirmSubmitButton
                        className="button button-secondary compact-button action-button action-button-secondary"
                        confirmationMessage={`「${item.name}」を削除しますか？`}
                      >
                        削除
                      </ConfirmSubmitButton>
                    </form>

                    <Link
                      className="button compact-button action-button action-button-primary"
                      href={`/register/fixed/${item.id}`}
                    >
                      編集
                    </Link>
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="section-card-footer section-card-footer-centered">
          <Link
            className="button button-secondary compact-button action-button action-button-primary"
            href="/register/fixed"
          >
            新規追加
          </Link>
        </div>
      </SectionCard>

      <div className="single-action-row">
        <Link
          className="button button-secondary compact-button action-button action-button-secondary bottom-back-button"
          href="/register"
        >
          back
        </Link>
      </div>
    </div>
  );
}
