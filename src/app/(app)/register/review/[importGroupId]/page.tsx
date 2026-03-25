import { notFound } from "next/navigation";
import { ReviewNotice } from "@/features/import-review/ReviewNotice";
import { DraftReviewPanel } from "@/features/import-review/DraftReviewPanel";
import { getDraftReviewSnapshot } from "@/lib/finance/queries";

type ReviewPageProps = {
  params: Promise<{
    importGroupId: string;
  }>;
  searchParams: Promise<{
    notice?: string;
  }>;
};

export default async function ReviewPage({ params, searchParams }: ReviewPageProps) {
  const { importGroupId } = await params;
  const { notice } = await searchParams;
  const snapshot = await getDraftReviewSnapshot(importGroupId);

  if (!snapshot) {
    notFound();
  }

  return (
    <div className="page-stack review-page-shell">
      <ReviewNotice notice={notice} />
      <DraftReviewPanel snapshot={snapshot} />
    </div>
  );
}
