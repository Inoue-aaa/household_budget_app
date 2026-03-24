import { NoticeBanner } from "@/components/NoticeBanner";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { ManualExpenseForm } from "@/features/manual-expenses/ManualExpenseForm";
import { listCategories } from "@/lib/finance/queries";

type ManualRegisterPageProps = {
  searchParams?: Promise<{
    occurredOn?: string;
  }>;
};

export default async function ManualRegisterPage({ searchParams }: ManualRegisterPageProps) {
  const categories = await listCategories();
  const params = searchParams ? await searchParams : undefined;
  const initialOccurredOn =
    params?.occurredOn && /^\d{4}-\d{2}-\d{2}$/.test(params.occurredOn) ? params.occurredOn : undefined;

  return (
    <div className="page-stack">
      <ScreenHeader
        eyebrow="Manual"
        title="手入力登録"
        description="レシートがない支出も、保存済み支出として直接登録できます。"
      />

      <NoticeBanner
        title="保存後は支出一覧へ移動します"
        description="手入力の内容は import_group と expense に保存され、分類履歴にも反映されます。"
      />

      <SectionCard
        title="入力項目"
        description="手入力でも import_group を作成するので、あとから削除や一覧整理がしやすい構成です。"
      >
        <ManualExpenseForm categories={categories} initialOccurredOn={initialOccurredOn} />
      </SectionCard>
    </div>
  );
}
