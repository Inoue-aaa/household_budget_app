import { NoticeBanner } from "@/components/NoticeBanner";
import { getExpensesNotice } from "@/lib/ui/notices";

type ExpensesNoticeCode = "created" | "deleted" | "delete_error";

export function ExpensesStatusBanner({
  code,
}: {
  code?: ExpensesNoticeCode;
}) {
  const config = getExpensesNotice(code);

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
