"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveThemePreferenceAction,
  type ThemePreferenceActionResult,
} from "@/features/theme-preferences/actions";
import {
  APP_THEME_ACCENTS_BY_SCHEME,
  APP_THEME_SCHEMES,
  parseThemeSelection,
  resolveThemeNameFromSelection,
  type AppThemeAccent,
  type AppThemeName,
  type AppThemeScheme,
} from "@/lib/theme/themes";

type ThemePreferenceFormProps = {
  currentTheme: AppThemeName;
  onSavedTheme?: (themeName: AppThemeName) => void;
};

function applyThemeToDocument(themeName: AppThemeName) {
  document.documentElement.dataset.theme = themeName;
  document.body.dataset.theme = themeName;
}

export function ThemePreferenceForm({
  currentTheme,
  onSavedTheme,
}: ThemePreferenceFormProps) {
  const router = useRouter();
  const initialSelection = useMemo(
    () => parseThemeSelection(currentTheme),
    [currentTheme]
  );
  const [scheme, setScheme] = useState<AppThemeScheme>(initialSelection.scheme);
  const [accent, setAccent] = useState<AppThemeAccent>(initialSelection.accent);
  const [result, setResult] = useState<ThemePreferenceActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const next = parseThemeSelection(currentTheme);
    setScheme(next.scheme);
    setAccent(next.accent);
  }, [currentTheme]);

  const accentOptions = APP_THEME_ACCENTS_BY_SCHEME[scheme];
  const selectedTheme = resolveThemeNameFromSelection(scheme, accent);

  useEffect(() => {
    applyThemeToDocument(selectedTheme);
  }, [selectedTheme]);

  return (
    <form
      className="field-stack theme-form"
      onSubmit={(event) => {
        event.preventDefault();

        const formData = new FormData();
        formData.set("themeName", selectedTheme);
        setResult(null);

        startTransition(async () => {
          const actionResult = await saveThemePreferenceAction(formData);

          if (actionResult.status === "unauthorized") {
            router.push("/login");
            return;
          }

          if (actionResult.status === "error") {
            const current = parseThemeSelection(currentTheme);
            setScheme(current.scheme);
            setAccent(current.accent);
            applyThemeToDocument(currentTheme);
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
      <div className="field-stack theme-selector-stack">
        <div className="field-stack theme-selector-group">
          <div>
            <p className="theme-section-label">表示モード</p>
            <p className="caption">画面全体の明るさを先に選べます。</p>
          </div>
          <div className="theme-scheme-grid">
            {APP_THEME_SCHEMES.map((option) => (
              <button
                aria-pressed={scheme === option.value}
                className="theme-scheme-card"
                data-active={scheme === option.value}
                disabled={isPending}
                key={option.value}
                onClick={() => {
                  const firstAccent = APP_THEME_ACCENTS_BY_SCHEME[option.value][0];
                  setScheme(option.value);
                  setAccent(firstAccent.value);
                }}
                type="button"
              >
                <span className="theme-scheme-title">{option.label}</span>
                <span className="theme-scheme-copy">
                  {option.value === "dark"
                    ? "落ち着いたダークトーン"
                    : "やわらかなライトトーン"}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="field-stack theme-selector-group">
          <div>
            <p className="theme-section-label">アクセント</p>
            <p className="caption">背景の雰囲気と差し色のニュアンスを選べます。</p>
          </div>
          <div className="theme-accent-grid">
            {accentOptions.map((option) => {
              const themeName = resolveThemeNameFromSelection(scheme, option.value);

              return (
                <button
                  aria-pressed={selectedTheme === themeName}
                  className="theme-accent-card"
                  data-active={selectedTheme === themeName}
                  disabled={isPending}
                  key={`${scheme}-${option.value}`}
                  onClick={() => setAccent(option.value)}
                  type="button"
                >
                  <span
                    className="theme-accent-preview"
                    style={
                      {
                        "--theme-preview-background": option.preview.background,
                        "--theme-preview-surface": option.preview.surface,
                        "--theme-preview-accent": option.preview.accent,
                      } as CSSProperties
                    }
                  />
                  <span className="theme-accent-meta">
                    <span className="theme-accent-label">{option.label}</span>
                    <span className="theme-accent-description">
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <input name="themeName" type="hidden" value={selectedTheme} />

      {result?.status === "error" ? (
        <p className="form-message form-message-error">{result.message}</p>
      ) : null}

      <button className="button" disabled={isPending} type="submit">
        {isPending ? "表示カラーを保存中..." : "表示カラーを保存"}
      </button>
    </form>
  );
}
