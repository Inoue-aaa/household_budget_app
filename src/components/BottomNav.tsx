"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CreditCard, Home, PlusCircle, Settings } from "lucide-react";
import {
  APP_SHELL_SET_TAB_EVENT,
  APP_SHELL_TAB_CHANGED_EVENT,
  getAppShellHref,
  isAppShellTab,
  type AppShellTab,
} from "@/features/app-shell/tabs";

const navItems = [
  { href: getAppShellHref("home") as Route, label: "ホーム", tab: "home", Icon: Home },
  {
    href: getAppShellHref("register") as Route,
    label: "登録",
    tab: "register",
    Icon: PlusCircle,
  },
  {
    href: getAppShellHref("expenses") as Route,
    label: "支出",
    tab: "expenses",
    Icon: CreditCard,
  },
  {
    href: getAppShellHref("settings") as Route,
    label: "設定",
    tab: "settings",
    Icon: Settings,
  },
] as const;

function resolveLegacyTab(pathname: string): AppShellTab {
  if (pathname.startsWith("/expenses/ai")) {
    return "home";
  }

  if (pathname === "/home/budget" || pathname.startsWith("/home/budget/")) {
    return "settings";
  }

  if (pathname.startsWith("/settings")) {
    return "settings";
  }

  if (pathname.startsWith("/expenses")) {
    return "expenses";
  }

  if (pathname.startsWith("/register")) {
    return "register";
  }

  return "home";
}

export function BottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shellTab = searchParams.get("tab");
  const derivedActiveTab =
    pathname === "/app" && shellTab && isAppShellTab(shellTab)
      ? shellTab
      : resolveLegacyTab(pathname);
  const [activeTab, setActiveTab] = useState<AppShellTab>(derivedActiveTab);

  useEffect(() => {
    setActiveTab(derivedActiveTab);
  }, [derivedActiveTab]);

  useEffect(() => {
    const handleChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ tab?: string }>).detail;

      if (detail?.tab && isAppShellTab(detail.tab)) {
        setActiveTab(detail.tab);
      }
    };

    window.addEventListener(APP_SHELL_TAB_CHANGED_EVENT, handleChanged as EventListener);
    return () => {
      window.removeEventListener(APP_SHELL_TAB_CHANGED_EVENT, handleChanged as EventListener);
    };
  }, []);

  return (
    <nav aria-label="主なナビゲーション" className="bottom-nav">
      <div className="bottom-nav-inner">
        {navItems.map((item) => (
          <Link
            className="bottom-nav-link"
            data-active={activeTab === item.tab}
            href={item.href}
            key={item.href}
            onClick={(event) => {
              if (pathname !== "/app") {
                return;
              }

              event.preventDefault();
              setActiveTab(item.tab);
              window.dispatchEvent(
                new CustomEvent(APP_SHELL_SET_TAB_EVENT, {
                  detail: { tab: item.tab },
                }),
              );
            }}
          >
            <item.Icon size={20} strokeWidth={2} />
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
