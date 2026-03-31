import { BackButton } from "@/components/BackButton";
import { notFound } from "next/navigation";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { FixedExpenseForm } from "@/features/fixed-expenses/FixedExpenseForm";
import { getRecurringExpenseById } from "@/features/fixed-expenses/queries";
import { listCategories } from "@/lib/finance/queries";

type FixedExpenseEditPageProps = {
  params: Promise<{
    recurringExpenseId: string;
  }>;
};

export default async function FixedExpenseEditPage({ params }: FixedExpenseEditPageProps) {
  const { recurringExpenseId } = await params;
  const [categories, recurringExpense] = await Promise.all([
    listCategories(),
    getRecurringExpenseById(recurringExpenseId),
  ]);

  if (!recurringExpense) {
    notFound();
  }

  return (
    <div className="page-stack">
      <ScreenHeader
        eyebrow="Recurring"
        title="固定費を編集"
        description="名称、金額、反映日、カテゴリを見直して更新できます。"
      />

      <SectionCard title="編集内容">
        <FixedExpenseForm
          categories={categories}
          footerMessage="※更新後は一覧画面へ移動します。"
          initialValues={{
            name: recurringExpense.name,
            amount: String(recurringExpense.amount),
            categoryId: recurringExpense.category_id,
            scheduleDay: String(recurringExpense.schedule_day),
            scheduleTime: recurringExpense.schedule_time.slice(0, 5),
            memo: recurringExpense.memo ?? "",
            isActive: recurringExpense.is_active ? "true" : "false",
          }}
          mode="edit"
          pendingLabel="更新中..."
          recurringExpenseId={recurringExpense.id}
          submitLabel="更新する"
        />
      </SectionCard>

      <div className="single-action-row">
        <BackButton
          className="button button-secondary compact-button action-button action-button-secondary bottom-back-button"
          fallbackHref="/register/fixed/list"
        />
      </div>
    </div>
  );
}
