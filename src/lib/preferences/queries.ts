import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DEFAULT_THEME_NAME, isAppThemeName, type AppThemeName } from "@/lib/theme/themes";

export async function getCurrentThemePreference(): Promise<AppThemeName> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return DEFAULT_THEME_NAME;
    }

    const { data, error } = await supabase
      .from("user_preferences")
      .select("theme_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data || !isAppThemeName(data.theme_name)) {
      return DEFAULT_THEME_NAME;
    }

    return data.theme_name;
  } catch {
    return DEFAULT_THEME_NAME;
  }
}
