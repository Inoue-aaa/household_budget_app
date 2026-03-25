export const APP_THEMES = [
  {
    name: "midnight",
    label: "Midnight",
    description: "深いネイビーを基調にした、標準のダークテーマです。",
    preview: {
      background: "#09111f",
      surface: "#13233a",
      accent: "#6f9cf0",
    },
  },
  {
    name: "beige",
    label: "Beige",
    description: "温かみのあるグレージュで整えた、落ち着いたテーマです。",
    preview: {
      background: "#16120f",
      surface: "#241d18",
      accent: "#c79a66",
    },
  },
  {
    name: "lime",
    label: "Lime",
    description: "深いオリーブを効かせた、引き締まったテーマです。",
    preview: {
      background: "#0d130d",
      surface: "#192219",
      accent: "#9fc85f",
    },
  },
  {
    name: "pink",
    label: "Pink",
    description: "ローズとプラムを含んだ、上品で落ち着いたテーマです。",
    preview: {
      background: "#151016",
      surface: "#241a27",
      accent: "#d48db0",
    },
  },
  {
    name: "sky",
    label: "Sky",
    description: "スレートブルー寄りで、軽やかに見えるテーマです。",
    preview: {
      background: "#0d1622",
      surface: "#172838",
      accent: "#75b8e8",
    },
  },
] as const;

export type AppThemeName = (typeof APP_THEMES)[number]["name"];

export const DEFAULT_THEME_NAME: AppThemeName = "midnight";

export function isAppThemeName(value: string): value is AppThemeName {
  return APP_THEMES.some((theme) => theme.name === value);
}
