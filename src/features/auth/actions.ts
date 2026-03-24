"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { AuthFormState } from "@/features/auth/form-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAllowedUserEmail, getBaseUrl } from "@/lib/utils/env";
import { normalizeEmail } from "@/lib/utils/text";

const loginSchema = z.object({
  email: z.string().email("メールアドレスの形式を確認してください。")
});

export async function requestMagicLinkAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email")
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message
    };
  }

  const email = normalizeEmail(parsed.data.email);
  const allowedEmail = getAllowedUserEmail();

  if (allowedEmail && email !== allowedEmail) {
    return {
      status: "error",
      message: "このアプリで許可されているメールアドレスではありません。"
    };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${getBaseUrl()}/auth/callback`
    }
  });

  if (error) {
    return {
      status: "error",
      message: "ログインリンクを送信できませんでした。設定を確認してください。"
    };
  }

  return {
    status: "success",
    message: "ログイン用リンクを送信しました。メールを確認してください。"
  };
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}
