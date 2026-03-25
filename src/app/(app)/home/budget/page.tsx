import Link from "next/link";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
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

      <SectionCard title="予算を編集">
        <BudgetSettingsForm
          categories={categories}
          initialBudgetAmount={budget.monthlyBudget}
          initialCategoryIds={budget.selectedCategoryIds}
          monthLabel={budget.monthLabel}
          targetMonth={budget.targetMonth}
        />
      </SectionCard>

      <div className="single-action-row">
        <Link
          className="button button-secondary compact-button action-button action-button-secondary bottom-back-button"
          href="/home"
        >
          back
        </Link>
      </div>
    </div>
  );
}
