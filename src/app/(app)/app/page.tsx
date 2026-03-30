import { BudgetAppShell } from "@/features/app-shell/BudgetAppShell";
import { getBudgetAppShellSnapshot } from "@/features/app-shell/server";
import {
  DEFAULT_APP_SHELL_TAB,
  isAppShellTab,
} from "@/features/app-shell/tabs";

type AppShellPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function normalizeSearchParams(
  params?: Record<string, string | string[] | undefined>
): Record<string, string | undefined> {
  if (!params) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ])
  );
}

export default async function AppShellPage({ searchParams }: AppShellPageProps) {
  const resolved = normalizeSearchParams(searchParams ? await searchParams : undefined);
  const activeTab = isAppShellTab(resolved.tab) ? resolved.tab : DEFAULT_APP_SHELL_TAB;
  const initialSnapshot = await getBudgetAppShellSnapshot();
  const initialNoticeCode =
    resolved.notice ??
    (resolved.created === "1" ? "created" : undefined) ??
    (resolved.deleted === "1" ? "deleted" : undefined) ??
    (resolved.delete_error === "1" ? "delete_error" : undefined);

  return (
    <BudgetAppShell
      initialNoticeCode={initialNoticeCode}
      initialSnapshot={initialSnapshot}
      initialTab={activeTab}
    />
  );
}
