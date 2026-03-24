"use client";

import { useSearchParams } from "next/navigation";
import { NoticeBanner } from "@/components/NoticeBanner";
import { getExpensesNotice } from "@/lib/ui/notices";

export function ExpensesStatusBanner() {
  const searchParams = useSearchParams();
  const code =
    searchParams.get("created") === "1"
      ? "created"
      : searchParams.get("deleted") === "1"
        ? "deleted"
        : searchParams.get("delete_error") === "1"
          ? "delete_error"
          : undefined;
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
