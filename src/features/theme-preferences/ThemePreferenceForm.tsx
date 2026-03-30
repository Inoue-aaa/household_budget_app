"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveThemePreferenceAction,
  type ThemePreferenceActionResult,
} from "@/features/theme-preferences/actions";
import { APP_THEMES, type AppThemeName } from "@/lib/theme/themes";

type ThemePreferenceFormProps = {
  currentTheme: AppThemeName;
  onSavedTheme?: (themeName: AppThemeName) => void;
};

export function ThemePreferenceForm({
  currentTheme,
  onSavedTheme,
}: ThemePreferenceFormProps) {
  const router = useRouter();
  const [selectedTheme, setSelectedTheme] = useState(currentTheme);
  const [result, setResult] = useState<ThemePreferenceActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSelectedTheme(currentTheme);
  }, [currentTheme]);

  const activeTheme = useMemo(() => selectedTheme, [selectedTheme]);

  return (
    <form
      className="field-stack"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const nextTheme = formData.get("themeName")?.toString() as AppThemeName | undefined;

        if (!nextTheme) {
          return;
        }

        setResult(null);
        setSelectedTheme(nextTheme);
        document.body.dataset.theme = nextTheme;

        startTransition(async () => {
          const actionResult = await saveThemePreferenceAction(formData);

          if (actionResult.status === "unauthorized") {
            router.push("/login");
            return;
          }

          if (actionResult.status === "error") {
            setSelectedTheme(currentTheme);
            document.body.dataset.theme = currentTheme;
            setResult(actionResult);
            return;
          }

          setResult(actionResult);
          if (actionResult.status === "success") {
            onSavedTheme?.(actionResult.themeName);
          }
          if (!onSavedTheme && actionResult.status === "success") {
            router.refresh();
          }
        });
      }}
    >
      <div className="theme-grid">
        {APP_THEMES.map((theme) => (
          <label className="theme-card" data-active={theme.name === activeTheme} key={theme.name}>
            <input
              checked={theme.name === activeTheme}
              disabled={isPending}
              name="themeName"
              onChange={() => {
                setSelectedTheme(theme.name);
                document.body.dataset.theme = theme.name;
              }}
              type="radio"
              value={theme.name}
            />
            <span
              className="theme-preview"
              style={
                {
                  "--theme-preview-background": theme.preview.background,
                  "--theme-preview-surface": theme.preview.surface,
                  "--theme-preview-accent": theme.preview.accent,
                } as CSSProperties
              }
            />
            <span>
              <span className="theme-card-title">{theme.label}</span>
              <span className="theme-card-description">{theme.description}</span>
            </span>
          </label>
        ))}
      </div>

      {result?.status === "error" ? (
        <p className="form-message form-message-error">{result.message}</p>
      ) : null}

      <button className="button" disabled={isPending} type="submit">
        {isPending ? "保存中..." : "表示カラーを保存"}
      </button>
    </form>
  );
}
