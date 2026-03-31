"use client";

import { Repeat2 } from "lucide-react";
import { SectionCard } from "@/components/SectionCard";
import { SubmitButton } from "@/components/SubmitButton";
import { addRecurringExpenseCandidateAction } from "@/features/fixed-expenses/actions";
import type { RecurringExpenseCandidateItem } from "@/lib/finance/types";
import { formatCurrency } from "@/lib/utils/format";

export function RecurringExpenseCandidatesSection({
  items,
}: {
  items: RecurringExpenseCandidateItem[];
}) {
  return (
    <SectionCard
      title="固定費 / サブスク候補"
      description="登録済みの固定費を、今月の支出としてここから追加できます。"
    >
      {items.length === 0 ? (
        <div className="empty-state">
          <p className="section-title">今月の候補はありません</p>
          <p className="section-copy">
            有効な固定費 / サブスクを登録すると、ここに候補として表示されます。
          </p>
        </div>
      ) : (
        <div className="list">
          {items.map((item) => (
            <section className="expense-card recurring-candidate-card" key={item.recurringExpenseId}>
              <div className="expense-card-main">
                <div className="expense-card-overline">
                  <span className={`pill ${item.isAlreadyAdded ? "" : "pill-accent"}`}>
                    {item.isAlreadyAdded ? "追加済み" : "未追加"}
                  </span>
                </div>

                <div className="section-card-link-header">
                  <div className="section-card-link-title">
                    <span className="section-card-link-icon section-card-link-icon-soft" aria-hidden="true">
                      <Repeat2 size={18} />
                    </span>
                    <div>
                      <p className="list-title">{item.name}</p>
                      <p className="list-meta">
                        {item.categoryName} ・ 毎月{item.scheduleDay}日 {item.scheduleTime}
                      </p>
                    </div>
                  </div>
                  <strong className="expense-amount">{formatCurrency(item.amount)}</strong>
                </div>

                {item.memo ? <p className="section-copy recurring-candidate-note">{item.memo}</p> : null}

                <div className="action-button-row action-button-row-centered expense-card-action-row">
                  <form action={addRecurringExpenseCandidateAction}>
                    <input
                      name="recurringExpenseId"
                      type="hidden"
                      value={item.recurringExpenseId}
                    />
                    <SubmitButton
                      className="button compact-button action-button action-button-primary"
                      disabled={item.isAlreadyAdded}
                      pendingLabel="追加中..."
                    >
                      {item.isAlreadyAdded ? "追加済み" : "追加する"}
                    </SubmitButton>
                  </form>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
