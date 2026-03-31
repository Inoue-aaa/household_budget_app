"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";

type BackButtonProps = {
  fallbackHref: string;
  className?: string;
  label?: string;
};

export function BackButton({
  fallbackHref,
  className = "",
  label = "back",
}: BackButtonProps) {
  const router = useRouter();

  return (
    <button
      className={className}
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
          return;
        }

        router.push(fallbackHref as Route);
      }}
      type="button"
    >
      {label}
    </button>
  );
}
