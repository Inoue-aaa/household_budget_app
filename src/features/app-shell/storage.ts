import type { AppShellSnapshot } from "@/features/app-shell/types";

const SNAPSHOT_VERSION = "v1";
const SNAPSHOT_KEY_PREFIX = `budget-app:snapshot:${SNAPSHOT_VERSION}:`;
const ACTIVE_TAB_KEY = "budget-app:active-tab";

export function getAppShellSnapshotStorageKey(accountId: string | null) {
  return `${SNAPSHOT_KEY_PREFIX}${accountId ?? "default"}`;
}

export function readStoredAppShellSnapshot(accountId: string | null) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getAppShellSnapshotStorageKey(accountId));

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as AppShellSnapshot;
    return parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export function writeStoredAppShellSnapshot(snapshot: AppShellSnapshot) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      getAppShellSnapshotStorageKey(snapshot.accountId),
      JSON.stringify(snapshot)
    );
  } catch {
    // Ignore localStorage failures.
  }
}

export function readStoredActiveTab() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ACTIVE_TAB_KEY);
}

export function writeStoredActiveTab(tab: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ACTIVE_TAB_KEY, tab);
  } catch {
    // Ignore localStorage failures.
  }
}
