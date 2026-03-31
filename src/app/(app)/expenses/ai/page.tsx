import type { Route } from "next";
import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { AiConsultationForm } from "@/features/analysis/AiConsultationForm";
import { getAiConsultationPageSnapshot } from "@/features/analysis/queries";

type AiConsultationPageProps = {
  searchParams?: Promise<{
    startDate?: string;
    endDate?: string;
    sessionId?: string;
  }>;
};

export default async function AiConsultationPage({
  searchParams,
}: AiConsultationPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const snapshot = await getAiConsultationPageSnapshot({
    startDate: params?.startDate,
    endDate: params?.endDate,
    sessionId: params?.sessionId,
  });

  return (
    <div className="page-stack">
      <ScreenHeader
        eyebrow="AI"
        title="AI相談"
        description="期間を選んで相談すると、支出の傾向や見直しポイントを集計データをもとに整理できます。"
      />

      {snapshot.monthlySuggestions.length > 0 ? (
        <SectionCard title={`${snapshot.monthLabel}の見直し候補`}>
          <div className="analysis-insight-list">
            {snapshot.monthlySuggestions.map((item) => {
              const budgetHref = (item.relatedCategoryId
                ? `/home/budget?focusCategory=${item.relatedCategoryId}#budget-category-${item.relatedCategoryId}`
                : "/home/budget") as Route;

              return (
                <div className="analysis-insight-card" key={item.id}>
                  <div className="analysis-insight-copy">
                    <p className="list-title">{item.title}</p>
                    <p className="list-meta">{item.summary}</p>
                  </div>
                  <div className="analysis-inline-actions">
                    <Link
                      className="button button-secondary compact-button action-button action-button-secondary analysis-inline-action"
                      href={budgetHref}
                    >
                      予算を見直す
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      ) : null}

      <AiConsultationForm
        defaultEndDate={snapshot.defaultEndDate}
        defaultStartDate={snapshot.defaultStartDate}
        initialSavedCards={snapshot.savedCards}
        initialSession={snapshot.activeSession}
        recentSessions={snapshot.recentSessions}
      />

      <div className="single-action-row">
        <BackButton
          className="button button-secondary compact-button action-button action-button-secondary bottom-back-button"
          fallbackHref="/app?tab=home"
        />
      </div>
    </div>
  );
}
