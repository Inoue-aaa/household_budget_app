import { getAuthenticatedAccountContext } from "@/lib/accounts/queries";
import {
  getDashboardSnapshot,
  getExpensesPageSnapshot,
  getPendingImportsPageSnapshot,
} from "@/lib/finance/queries";
import { getCurrentThemeAndAccountPreference } from "@/lib/preferences/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppShellSnapshot } from "@/features/app-shell/types";

export async function getBudgetAppShellSnapshot(): Promise<AppShellSnapshot> {
  const supabase = await createServerSupabaseClient();
  const [
    {
      data: { user },
    },
    preferenceSnapshot,
    home,
    register,
    expenses,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getCurrentThemeAndAccountPreference(),
    getDashboardSnapshot(),
    getPendingImportsPageSnapshot(),
    getExpensesPageSnapshot(12),
  ]);

  const account =
    preferenceSnapshot.account ??
    home.account ??
    register.account ??
    expenses.account ??
    (await getAuthenticatedAccountContext());

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    accountId: account?.currentAccount.id ?? null,
    home,
    register,
    expenses,
    settings: {
      themeName: preferenceSnapshot.themeName,
      userEmail: user?.email ?? null,
      account,
    },
  };
}
