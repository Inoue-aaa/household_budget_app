"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/home", label: "ホーム" },
  { href: "/register", label: "登録" },
  { href: "/expenses", label: "支出" },
  { href: "/settings", label: "設定" }
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="主なナビゲーション" className="bottom-nav">
      <div className="bottom-nav-inner">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              className="bottom-nav-link"
              data-active={active}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
