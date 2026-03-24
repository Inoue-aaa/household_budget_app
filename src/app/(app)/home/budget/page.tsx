import Link from "next/link";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { BudgetProgressCard } from "@/features/monthly-budget/BudgetProgressCard";
import { BudgetSettingsForm } from "@/features/monthly-budget/BudgetSettingsForm";
import { getMonthlyBudgetOverview, listCategories } from "@/lib/finance/queries";

export default async function HomeBudgetPage() {
  const [budget, categories] = await Promise.all([getMonthlyBudgetOverview(), listCategories()]);

  return (
    <div className="page-stack">
      <ScreenHeader
        eyebrow="Budget"
        title="今月の予算設定"
        description="総予算額と集計対象カテゴリを設定します。固定費を除きたいときは、対象カテゴリから外してください。"
      />

      <BudgetProgressCard budget={budget} />

      <SectionCard
        title="予算を編集"
        description="予算額と対象カテゴリは、月ごとにまとめて更新できます。保存後はホームの進捗カードに反映されます。"
      >
        <BudgetSettingsForm
          categories={categories}
          initialBudgetAmount={budget.monthlyBudget}
          initialCategoryIds={budget.selectedCategoryIds}
          monthLabel={budget.monthLabel}
          targetMonth={budget.targetMonth}
        />
      </SectionCard>

      <Link className="button button-secondary compact-button bottom-back-button" href="/home">
        back
      </Link>
    </div>
  );
}
