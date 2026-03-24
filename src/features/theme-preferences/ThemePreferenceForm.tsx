"use client";

import type { CSSProperties } from "react";
import { saveThemePreferenceAction } from "@/features/theme-preferences/actions";
import { APP_THEMES, type AppThemeName } from "@/lib/theme/themes";

type ThemePreferenceFormProps = {
  currentTheme: AppThemeName;
};

export function ThemePreferenceForm({ currentTheme }: ThemePreferenceFormProps) {
  return (
    <form action={saveThemePreferenceAction} className="field-stack">
      <div className="theme-grid">
        {APP_THEMES.map((theme) => (
          <label className="theme-card" data-active={theme.name === currentTheme} key={theme.name}>
            <input
              defaultChecked={theme.name === currentTheme}
              name="themeName"
              type="radio"
              value={theme.name}
            />
            <span
              className="theme-preview"
              style={
                {
                  "--theme-preview-background": theme.preview.background,
                  "--theme-preview-surface": theme.preview.surface,
                  "--theme-preview-accent": theme.preview.accent
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

      <button className="button" type="submit">
        表示カラーを保存
      </button>
    </form>
  );
}
