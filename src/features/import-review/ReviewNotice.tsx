import { NoticeBanner } from "@/components/NoticeBanner";
import { getReviewNotice } from "@/lib/ui/notices";

export function ReviewNotice({ notice }: { notice?: string }) {
  const config = getReviewNotice(notice);

  if (!config) {
    return null;
  }

  return (
    <NoticeBanner
      tone={config.tone}
      title={config.title}
      description={config.description}
    />
  );
}
