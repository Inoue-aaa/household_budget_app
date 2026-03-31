import { BackButton } from "@/components/BackButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { AiConsultationForm } from "@/features/analysis/AiConsultationForm";
import { getAnalysisSnapshot } from "@/lib/finance/queries";

type AiConsultationPageProps = {
  searchParams?: Promise<{
    startDate?: string;
    endDate?: string;
  }>;
};

export default async function AiConsultationPage({
  searchParams,
}: AiConsultationPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const snapshot = await getAnalysisSnapshot({
    startDate: params?.startDate,
    endDate: params?.endDate,
  });

  return (
    <div className="page-stack">
      <ScreenHeader
        eyebrow="AI"
        title="AI相談"
        description="期間を選んで質問すると、その範囲の集計データをもとに相談できます。"
      />

      <SectionCard
        title="相談内容"
        description="開始日と終了日、質問内容を選んで送信できます。"
      >
        <AiConsultationForm
          defaultEndDate={snapshot.period.endDate}
          defaultStartDate={snapshot.period.startDate}
        />
      </SectionCard>

      <div className="single-action-row">
        <BackButton
          className="button button-secondary compact-button action-button action-button-secondary bottom-back-button"
          fallbackHref="/expenses"
        />
      </div>
    </div>
  );
}
