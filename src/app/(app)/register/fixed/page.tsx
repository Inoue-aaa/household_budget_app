import { BackButton } from "@/components/BackButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { FixedExpenseForm } from "@/features/fixed-expenses/FixedExpenseForm";
import { listCategories } from "@/lib/finance/queries";

export default async function FixedExpenseRegisterPage() {
  const categories = await listCategories();

  return (
    <div className="page-stack">
      <ScreenHeader
        eyebrow="Recurring"
        title="固定費 / サブスク登録"
        description="毎月発生する支出を登録できます。反映日とカテゴリを設定して保存します。"
      />

      <SectionCard title="入力項目">
        <FixedExpenseForm categories={categories} />
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
