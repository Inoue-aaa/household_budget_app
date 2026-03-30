import type { CurrentAccountSnapshot, DashboardSnapshot, ExpensesPageSnapshot, PendingImportsPageSnapshot } from "@/lib/finance/types";
import type { AppThemeName } from "@/lib/theme/themes";

export type AppShellSettingsSnapshot = {
  themeName: AppThemeName;
  userEmail: string | null;
  account: CurrentAccountSnapshot | null;
};

export type AppShellSnapshot = {
  version: 1;
  createdAt: string;
  accountId: string | null;
  home: DashboardSnapshot;
  register: PendingImportsPageSnapshot;
  expenses: ExpensesPageSnapshot;
  settings: AppShellSettingsSnapshot;
};
