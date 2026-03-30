export const APP_TABS = ["home", "register", "expenses", "settings"] as const;

export type AppShellTab = (typeof APP_TABS)[number];

export const DEFAULT_APP_SHELL_TAB: AppShellTab = "home";
export const APP_SHELL_SET_TAB_EVENT = "budget-app:set-tab";
export const APP_SHELL_TAB_CHANGED_EVENT = "budget-app:tab-changed";

export function isAppShellTab(value?: string): value is AppShellTab {
  return APP_TABS.includes(value as AppShellTab);
}

export function getAppShellHref(tab: AppShellTab) {
  return `/app?tab=${tab}`;
}
