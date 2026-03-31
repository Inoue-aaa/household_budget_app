import { BackButton } from "@/components/BackButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { ManualExpenseForm } from "@/features/manual-expenses/ManualExpenseForm";
import { listCategories } from "@/lib/finance/queries";

type ManualRegisterPageProps = {
  searchParams?: Promise<{
    occurredOn?: string;
  }>;
};

export default async function ManualRegisterPage({
  searchParams,
}: ManualRegisterPageProps) {
  const categories = await listCategories();
  const params = searchParams ? await searchParams : undefined;
  const initialOccurredOn =
    params?.occurredOn && /^\d{4}-\d{2}-\d{2}$/.test(params.occurredOn)
      ? params.occurredOn
      : undefined;

  return (
    <div className="page-stack">
      <ScreenHeader
        eyebrow="Manual"
        title="手入力登録"
        description="レシートがない支出を直接登録できます。"
      />

      <SectionCard title="入力項目">
        <ManualExpenseForm
          categories={categories}
          initialOccurredOn={initialOccurredOn}
        />
      </SectionCard>

      <div className="single-action-row">
        <BackButton
          className="button button-secondary compact-button action-button action-button-secondary bottom-back-button"
          fallbackHref="/register"
        />
      </div>
    </div>
  );
}
