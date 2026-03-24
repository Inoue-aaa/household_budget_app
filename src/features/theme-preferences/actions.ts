"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { APP_THEMES } from "@/lib/theme/themes";

const themeSchema = z.object({
  themeName: z.enum(APP_THEMES.map((theme) => theme.name) as [string, ...string[]])
});

export async function saveThemePreferenceAction(formData: FormData) {
  const parsed = themeSchema.safeParse({
    themeName: formData.get("themeName")
  });

  if (!parsed.success) {
    redirect("/settings?notice=theme_error");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: user.id,
      theme_name: parsed.data.themeName
    },
    {
      onConflict: "user_id"
    }
  );

  if (error) {
    redirect("/settings?notice=theme_error");
  }

  revalidatePath("/settings");
  revalidatePath("/home");
  revalidatePath("/home/budget");
  revalidatePath("/home/categories");
  revalidatePath("/expenses");
  revalidatePath("/expenses/reports");
  revalidatePath("/expenses/history");
  revalidatePath("/register");
  redirect("/settings?notice=theme_saved");
}
