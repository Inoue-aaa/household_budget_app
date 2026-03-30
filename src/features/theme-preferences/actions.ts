"use server";

import { z } from "zod";
import { upsertUserPreferencesPatch } from "@/lib/accounts/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { APP_THEMES, type AppThemeName } from "@/lib/theme/themes";

export type ThemePreferenceActionResult =
  | {
      status: "success";
      themeName: AppThemeName;
    }
  | {
      status: "error" | "unauthorized";
      message: string;
    };

const themeSchema = z.object({
  themeName: z.enum(APP_THEMES.map((theme) => theme.name) as [string, ...string[]])
});

export async function saveThemePreferenceAction(
  formData: FormData
): Promise<ThemePreferenceActionResult> {
  const parsed = themeSchema.safeParse({
    themeName: formData.get("themeName")
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "表示カラーを保存できませんでした。"
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "unauthorized",
      message: "ログイン状態を確認できませんでした。"
    };
  }

  try {
    await upsertUserPreferencesPatch(supabase, user.id, {
      themeName: parsed.data.themeName as AppThemeName,
    });
  } catch {
    return {
      status: "error",
      message: "表示カラーを保存できませんでした。"
    };
  }

  return {
    status: "success",
    themeName: parsed.data.themeName as AppThemeName
  };
}
