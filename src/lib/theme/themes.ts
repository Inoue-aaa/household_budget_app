export const APP_THEMES = [
  {
    name: "midnight",
    label: "Midnight",
    description: "深いネイビーを基調にした、標準のダークテーマです。",
    preview: {
      background: "#0a1220",
      surface: "#111a2a",
      accent: "#5f8fe8"
    }
  },
  {
    name: "beige",
    label: "Beige",
    description: "やわらかなグレージュで整えた、温かみのあるテーマです。",
    preview: {
      background: "#ebe1d3",
      surface: "#d7c6b2",
      accent: "#8a6a45"
    }
  },
  {
    name: "lime",
    label: "Lime",
    description: "深いオリーブを効かせた、引き締まったテーマです。",
    preview: {
      background: "#10150f",
      surface: "#18211a",
      accent: "#91bf61"
    }
  },
  {
    name: "pink",
    label: "Pink",
    description: "ローズとプラムを含んだ、上品で落ち着いたテーマです。",
    preview: {
      background: "#171117",
      surface: "#241b24",
      accent: "#cf86aa"
    }
  },
  {
    name: "sky",
    label: "Sky",
    description: "スレートブルー寄りで、軽やかに見えるテーマです。",
    preview: {
      background: "#0d1623",
      surface: "#152334",
      accent: "#68b2e1"
    }
  }
] as const;

export type AppThemeName = (typeof APP_THEMES)[number]["name"];

export const DEFAULT_THEME_NAME: AppThemeName = "midnight";

export function isAppThemeName(value: string): value is AppThemeName {
  return APP_THEMES.some((theme) => theme.name === value);
}
