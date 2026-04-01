"use client";

import type { Route } from "next";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExpensesTabPanel } from "@/features/app-shell/ExpensesTabPanel";
import { HomeTabPanel } from "@/features/app-shell/HomeTabPanel";
import { RegisterTabPanel } from "@/features/app-shell/RegisterTabPanel";
import { SettingsTabPanel } from "@/features/app-shell/SettingsTabPanel";
import {
  readStoredActiveTab,
  readStoredAppShellSnapshot,
  writeStoredActiveTab,
  writeStoredAppShellSnapshot,
} from "@/features/app-shell/storage";
import type { AppShellSnapshot } from "@/features/app-shell/types";
import {
  APP_SHELL_SET_TAB_EVENT,
  APP_SHELL_TAB_CHANGED_EVENT,
  isAppShellTab,
  type AppShellTab,
} from "@/features/app-shell/tabs";
import { switchCurrentAccountAction, type SwitchAccountActionResult } from "@/features/account-switcher/actions";
import type { AppThemeName } from "@/lib/theme/themes";

type BudgetAppShellProps = {
  initialTab: AppShellTab;
  initialSnapshot: AppShellSnapshot;
  initialNoticeCode?: string;
};

function buildShellUrl(tab: AppShellTab) {
  return `/app?tab=${tab}`;
}

type IdleCallbackHandle = number;
type IdleCallbackDeadline = { didTimeout: boolean; timeRemaining: () => number };

function runWhenIdle(callback: () => void) {
  const idleWindow = window as Window & {
    requestIdleCallback?: (
      cb: (deadline: IdleCallbackDeadline) => void,
      options?: { timeout: number },
    ) => IdleCallbackHandle;
    cancelIdleCallback?: (handle: IdleCallbackHandle) => void;
  };

  if (typeof idleWindow.requestIdleCallback === "function") {
    const handle = idleWindow.requestIdleCallback(() => callback(), {
      timeout: 1200,
    });

    return () => {
      if (typeof idleWindow.cancelIdleCallback === "function") {
        idleWindow.cancelIdleCallback(handle);
      }
    };
  }

  const handle = window.setTimeout(callback, 180);
  return () => window.clearTimeout(handle);
}

function applyThemeToDocument(themeName: AppThemeName) {
  document.documentElement.dataset.theme = themeName;
  document.body.dataset.theme = themeName;
}

async function fetchAppShellSnapshot() {
  const response = await fetch("/api/app-shell-snapshot", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch app shell snapshot");
  }

  return (await response.json()) as AppShellSnapshot;
}

export function BudgetAppShell({
  initialTab,
  initialSnapshot,
  initialNoticeCode,
}: BudgetAppShellProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AppShellTab>(initialTab);
  const [snapshot, setSnapshot] = useState<AppShellSnapshot>(initialSnapshot);
  const [noticeCode, setNoticeCode] = useState<string | undefined>(initialNoticeCode);
  const [isAccountSwitching, startAccountTransition] = useTransition();
  const [accountSwitchError, setAccountSwitchError] = useState<string | null>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    setSnapshot(initialSnapshot);
    writeStoredAppShellSnapshot(initialSnapshot);
  }, [initialSnapshot]);

  useEffect(() => {
    const cached = readStoredAppShellSnapshot(initialSnapshot.accountId);
    if (cached?.accountId === initialSnapshot.accountId) {
      setSnapshot((current) =>
        current.createdAt >= cached.createdAt ? current : cached
      );
    }

    const storedTab = readStoredActiveTab();
    if (storedTab && isAppShellTab(storedTab) && !initialNoticeCode) {
      setActiveTab(storedTab);
    }
  }, [initialSnapshot.accountId, initialNoticeCode]);

  useEffect(() => {
    let cancelled = false;

    void fetchAppShellSnapshot()
      .then((freshSnapshot) => {
        if (cancelled) {
          return;
        }

        setSnapshot(freshSnapshot);
        writeStoredAppShellSnapshot(freshSnapshot);
      })
      .catch(() => {
        // Keep the current snapshot if the background sync fails.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    writeStoredAppShellSnapshot(snapshot);
  }, [snapshot]);

  useEffect(() => {
    writeStoredActiveTab(activeTab);
    window.dispatchEvent(
      new CustomEvent(APP_SHELL_TAB_CHANGED_EVENT, {
        detail: { tab: activeTab },
      })
    );
    window.history.replaceState(null, "", buildShellUrl(activeTab));
    if (hasMountedRef.current) {
      setNoticeCode(undefined);
    } else {
      hasMountedRef.current = true;
    }
  }, [activeTab]);

  useEffect(() => {
    const handleSetTab = (event: Event) => {
      const detail = (event as CustomEvent<{ tab?: string }>).detail;
      if (detail?.tab && isAppShellTab(detail.tab)) {
        setActiveTab(detail.tab);
      }
    };

    window.addEventListener(APP_SHELL_SET_TAB_EVENT, handleSetTab as EventListener);
    return () => {
      window.removeEventListener(APP_SHELL_SET_TAB_EVENT, handleSetTab as EventListener);
    };
  }, []);

  useEffect(() => {
    const targetMonth = snapshot.home.budget.targetMonth.slice(0, 7);
    const routes: Route[] =
      activeTab === "home"
        ? [
            "/home/budget",
            `/home/budget/detail?month=${targetMonth}` as Route,
            "/expenses/ai",
          ]
        : activeTab === "expenses"
          ? [
              `/expenses/reports?month=${targetMonth}` as Route,
              `/expenses/summary?month=${targetMonth}` as Route,
              `/expenses/history?month=${targetMonth}` as Route,
            ]
          : [];

    if (routes.length === 0) {
      return;
    }

    let cancelled = false;
    const cancelIdle = runWhenIdle(() => {
      if (cancelled) {
        return;
      }

      routes.forEach((route, index) => {
        window.setTimeout(() => {
          if (!cancelled) {
            router.prefetch(route);
          }
        }, index * 140);
      });
    });

    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [activeTab, router, snapshot.accountId, snapshot.home.budget.targetMonth]);

  const handleThemeSaved = useCallback((themeName: AppThemeName) => {
    setSnapshot((current) => ({
      ...current,
      settings: {
        ...current.settings,
        themeName,
      },
    }));
  }, []);

  const handleSwitchAccount = useCallback(
    async (accountId: string): Promise<SwitchAccountActionResult> => {
      setAccountSwitchError(null);

      return await new Promise<SwitchAccountActionResult>((resolve) => {
        startAccountTransition(async () => {
          const formData = new FormData();
          formData.set("accountId", accountId);
          const actionResult = await switchCurrentAccountAction(formData);

          if (actionResult.status !== "success") {
            setAccountSwitchError(actionResult.message);
            resolve(actionResult);
            return;
          }

          const cached = readStoredAppShellSnapshot(accountId);

          if (cached) {
            setSnapshot(cached);
          }

          try {
            const freshSnapshot = await fetchAppShellSnapshot();
            setSnapshot(freshSnapshot);
            writeStoredAppShellSnapshot(freshSnapshot);
            applyThemeToDocument(freshSnapshot.settings.themeName);
            resolve(actionResult);
          } catch {
            if (cached) {
              resolve(actionResult);
              return;
            }

            const fallbackResult: SwitchAccountActionResult = {
              status: "error",
              message: "アカウントの切り替えに失敗しました。",
            };
            setAccountSwitchError(fallbackResult.message);
            resolve(fallbackResult);
          }
        });
      });
    },
    []
  );

  const panel = useMemo(() => {
    switch (activeTab) {
      case "register":
        return <RegisterTabPanel snapshot={snapshot.register} noticeCode={noticeCode} />;
      case "expenses":
        return <ExpensesTabPanel snapshot={snapshot.expenses} noticeCode={noticeCode} />;
      case "settings":
        return (
          <SettingsTabPanel
            accounts={snapshot.settings.account?.accounts ?? []}
            currentAccountId={snapshot.settings.account?.currentAccount.id ?? null}
            onSwitchAccount={handleSwitchAccount}
            onThemeSaved={handleThemeSaved}
            themeName={snapshot.settings.themeName}
            userEmail={snapshot.settings.userEmail}
          />
        );
      case "home":
      default:
        return <HomeTabPanel snapshot={snapshot.home} noticeCode={noticeCode} />;
    }
  }, [activeTab, handleSwitchAccount, handleThemeSaved, noticeCode, snapshot]);

  return (
    <>
      {panel}
      {isAccountSwitching ? (
        <div className="app-shell-loading-overlay" role="presentation">
          <div className="app-shell-loading-dialog" role="status" aria-live="polite">
            <span className="app-shell-loading-spinner" aria-hidden="true" />
            <p className="app-shell-loading-title">アカウントを切り替えています…</p>
            <p className="app-shell-loading-copy">データを読み込んでいます…</p>
          </div>
        </div>
      ) : null}
      {accountSwitchError ? (
        <div className="app-shell-floating-message" role="status" aria-live="polite">
          {accountSwitchError}
        </div>
      ) : null}
    </>
  );
}
