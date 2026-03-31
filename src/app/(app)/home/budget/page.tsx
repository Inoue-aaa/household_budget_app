import Link from "next/link";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { BudgetSettingsForm } from "@/features/monthly-budget/BudgetSettingsForm";
import { getBudgetTemplateSnapshot } from "@/lib/finance/queries";

export default async function HomeBudgetPage() {
  const snapshot = await getBudgetTemplateSnapshot();

  return (
    <div className="page-stack">
      <ScreenHeader
        eyebrow="Budget"
        title="今月の予算設定"
        description="全体予算とカテゴリ別予算を設定できます。保存した内容は今月と次月以降の基本設定に使われます。"
      />

      <SectionCard title="予算を編集">
        <BudgetSettingsForm
          categories={snapshot.categories}
          initialBudgetAmount={snapshot.totalBudget}
          initialCategoryBudgets={snapshot.categoryBudgets}
          monthLabel={snapshot.monthLabel}
          targetMonth={snapshot.targetMonth}
          tracksCategoryBudgets={snapshot.tracksCategoryBudgets}
        />
      </SectionCard>

      <div className="single-action-row">
        <Link
          className="button button-secondary compact-button action-button action-button-secondary bottom-back-button"
          href="/app?tab=home"
        >
          back
        </Link>
      </div>
    </div>
  );
}
