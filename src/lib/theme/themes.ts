export const APP_THEMES = [
  {
    name: "midnight",
    scheme: "dark",
    accent: "midnight",
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
    scheme: "dark",
    accent: "beige",
    label: "Beige",
    description: "やわらかなグレージュで整えた、温かみのあるダークテーマです。",
    preview: {
      background: "#16120f",
      surface: "#241d18",
      accent: "#c79a66",
    },
  },
  {
    name: "lime",
    scheme: "dark",
    accent: "lime",
    label: "Lime",
    description: "深いオリーブを効かせた、引き締まったダークテーマです。",
    preview: {
      background: "#0d130d",
      surface: "#192219",
      accent: "#9fc85f",
    },
  },
  {
    name: "pink",
    scheme: "dark",
    accent: "rose",
    label: "Pink",
    description: "ローズとプラムを含んだ、上品で落ち着いたダークテーマです。",
    preview: {
      background: "#151016",
      surface: "#241a27",
      accent: "#d48db0",
    },
  },
  {
    name: "sky",
    scheme: "dark",
    accent: "teal",
    label: "Sky",
    description: "スレートブルー寄りで、軽やかに見えるダークテーマです。",
    preview: {
      background: "#0d1622",
      surface: "#172838",
      accent: "#75b8e8",
    },
  },
  {
    name: "forest",
    scheme: "dark",
    accent: "sage",
    label: "Forest",
    description: "深い森の緑を基調にした、静かなダークテーマです。",
    preview: {
      background: "#0b1410",
      surface: "#192519",
      accent: "#5cb87a",
    },
  },
  {
    name: "amber",
    scheme: "dark",
    accent: "amber",
    label: "Amber",
    description: "控えめな琥珀色を効かせた、落ち着いたダークテーマです。",
    preview: {
      background: "#141008",
      surface: "#231c10",
      accent: "#d4a044",
    },
  },
  {
    name: "light",
    scheme: "light",
    accent: "default",
    label: "Light",
    description: "やわらかなグレーホワイトで整えた、標準のライトテーマです。",
    preview: {
      background: "#eef3f9",
      surface: "#ffffff",
      accent: "#5f8fe8",
    },
  },
  {
    name: "light-teal",
    scheme: "light",
    accent: "teal",
    label: "Light Teal",
    description: "淡い青緑を含んだ、清潔感のあるライトテーマです。",
    preview: {
      background: "#eef7f8",
      surface: "#ffffff",
      accent: "#4ca7ba",
    },
  },
  {
    name: "light-rose",
    scheme: "light",
    accent: "rose",
    label: "Light Rose",
    description: "ローズを少し含んだ、やわらかなライトテーマです。",
    preview: {
      background: "#f8f1f5",
      surface: "#ffffff",
      accent: "#c97ea0",
    },
  },
  {
    name: "light-amber",
    scheme: "light",
    accent: "amber",
    label: "Light Amber",
    description: "あたたかい琥珀色を含んだ、上品なライトテーマです。",
    preview: {
      background: "#faf4e8",
      surface: "#fffdf8",
      accent: "#c9923d",
    },
  },
  {
    name: "light-sage",
    scheme: "light",
    accent: "sage",
    label: "Light Sage",
    description: "静かなセージグリーンを含んだ、落ち着いたライトテーマです。",
    preview: {
      background: "#eef4ef",
      surface: "#ffffff",
      accent: "#6aa780",
    },
  },
] as const;

export type AppThemeName = (typeof APP_THEMES)[number]["name"];
export type AppThemeScheme = "dark" | "light";
export type AppThemeAccent =
  | "midnight"
  | "beige"
  | "lime"
  | "rose"
  | "teal"
  | "sage"
  | "amber"
  | "default";

export const DEFAULT_THEME_NAME: AppThemeName = "midnight";

export const APP_THEME_SCHEMES = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const satisfies ReadonlyArray<{ value: AppThemeScheme; label: string }>;

export const APP_THEME_ACCENTS_BY_SCHEME: Record<
  AppThemeScheme,
  Array<{
    value: AppThemeAccent;
    label: string;
    description: string;
    preview: { background: string; surface: string; accent: string };
  }>
> = {
  dark: [
    {
      value: "midnight",
      label: "Midnight",
      description: "標準",
      preview: APP_THEMES[0].preview,
    },
    {
      value: "beige",
      label: "Beige",
      description: "温かい",
      preview: APP_THEMES[1].preview,
    },
    {
      value: "lime",
      label: "Lime",
      description: "深い緑",
      preview: APP_THEMES[2].preview,
    },
    {
      value: "rose",
      label: "Rose",
      description: "上品",
      preview: APP_THEMES[3].preview,
    },
    {
      value: "teal",
      label: "Sky",
      description: "軽やか",
      preview: APP_THEMES[4].preview,
    },
    {
      value: "sage",
      label: "Forest",
      description: "静かな緑",
      preview: APP_THEMES[5].preview,
    },
    {
      value: "amber",
      label: "Amber",
      description: "琥珀色",
      preview: APP_THEMES[6].preview,
    },
  ],
  light: [
    {
      value: "default",
      label: "Default",
      description: "標準",
      preview: APP_THEMES[7].preview,
    },
    {
      value: "teal",
      label: "Teal",
      description: "青緑",
      preview: APP_THEMES[8].preview,
    },
    {
      value: "rose",
      label: "Rose",
      description: "やわらかい",
      preview: APP_THEMES[9].preview,
    },
    {
      value: "amber",
      label: "Amber",
      description: "温かい",
      preview: APP_THEMES[10].preview,
    },
    {
      value: "sage",
      label: "Sage",
      description: "穏やか",
      preview: APP_THEMES[11].preview,
    },
  ],
};

export function isAppThemeName(value: string): value is AppThemeName {
  return APP_THEMES.some((theme) => theme.name === value);
}

export function getAppThemeByName(themeName: AppThemeName) {
  return APP_THEMES.find((theme) => theme.name === themeName) ?? APP_THEMES[0];
}

export function parseThemeSelection(themeName: AppThemeName): {
  scheme: AppThemeScheme;
  accent: AppThemeAccent;
} {
  const theme = getAppThemeByName(themeName);

  return {
    scheme: theme.scheme,
    accent: theme.accent,
  };
}

export function resolveThemeNameFromSelection(
  scheme: AppThemeScheme,
  accent: AppThemeAccent
): AppThemeName {
  if (scheme === "light") {
    switch (accent) {
      case "teal":
        return "light-teal";
      case "rose":
        return "light-rose";
      case "amber":
        return "light-amber";
      case "sage":
        return "light-sage";
      case "default":
      default:
        return "light";
    }
  }

  switch (accent) {
    case "beige":
      return "beige";
    case "lime":
      return "lime";
    case "rose":
      return "pink";
    case "teal":
      return "sky";
    case "sage":
      return "forest";
    case "amber":
      return "amber";
    case "midnight":
    case "default":
    default:
      return "midnight";
  }
}
