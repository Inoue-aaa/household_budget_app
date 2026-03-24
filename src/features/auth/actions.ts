"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { AuthFormState } from "@/features/auth/form-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAllowedUserEmail, getBaseUrl } from "@/lib/utils/env";
import { normalizeEmail } from "@/lib/utils/text";

const loginSchema = z.object({
  email: z.string().email("メールアドレスの形式を確認してください。"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください。")
});

const signUpSchema = loginSchema.extend({
  passwordConfirm: z.string().min(8, "確認用パスワードは8文字以上で入力してください。")
});

function buildValues(formData: FormData) {
  return {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    passwordConfirm: String(formData.get("passwordConfirm") ?? "")
  };
}

function buildErrorState(
  values: ReturnType<typeof buildValues>,
  message: string,
  fieldErrors?: AuthFormState["fieldErrors"]
): AuthFormState {
  return {
    status: "error",
    message,
    fieldErrors,
    values
  };
}

function buildFieldErrors(
  fieldName: string | undefined,
  message: string
): AuthFormState["fieldErrors"] | undefined {
  if (
    fieldName === "email" ||
    fieldName === "password" ||
    fieldName === "passwordConfirm"
  ) {
    return {
      [fieldName]: message
    };
  }

  return undefined;
}

function getAllowedEmailError(email: string) {
  const allowedEmail = getAllowedUserEmail();

  if (allowedEmail && email !== allowedEmail) {
    return "このアプリで利用できるメールアドレスではありません。";
  }

  return null;
}

function mapSignInError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "メールアドレスまたはパスワードが正しくありません。";
  }

  if (normalized.includes("email not confirmed")) {
    return "メール確認がまだ完了していません。確認メールをご確認ください。";
  }

  return "ログインできませんでした。入力内容をご確認ください。";
}

function mapSignUpError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("user already registered")) {
    return "このメールアドレスはすでに登録されています。ログインしてください。";
  }

  if (normalized.includes("password")) {
    return "パスワードの条件を確認して、もう一度お試しください。";
  }

  return "アカウントを作成できませんでした。時間をおいて再度お試しください。";
}

export async function signInWithPasswordAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const values = buildValues(formData);
  const parsed = loginSchema.safeParse(values);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue?.message ?? "入力内容を確認してください。";
    return buildErrorState(values, message, buildFieldErrors(String(issue?.path[0] ?? ""), message));
  }

  const email = normalizeEmail(parsed.data.email);
  const allowedEmailError = getAllowedEmailError(email);

  if (allowedEmailError) {
    return buildErrorState({ ...values, email }, allowedEmailError, {
      email: allowedEmailError
    });
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password
  });

  if (error) {
    const message = mapSignInError(error.message);
    return buildErrorState({ ...values, email }, message, {
      password: message
    });
  }

  redirect("/home");
}

export async function signUpWithPasswordAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const values = buildValues(formData);
  const parsed = signUpSchema.safeParse(values);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue?.message ?? "入力内容を確認してください。";
    return buildErrorState(values, message, buildFieldErrors(String(issue?.path[0] ?? ""), message));
  }

  const email = normalizeEmail(parsed.data.email);
  const allowedEmailError = getAllowedEmailError(email);

  if (allowedEmailError) {
    return buildErrorState({ ...values, email }, allowedEmailError, {
      email: allowedEmailError
    });
  }

  if (parsed.data.password !== parsed.data.passwordConfirm) {
    return buildErrorState({ ...values, email }, "確認用パスワードが一致していません。", {
      passwordConfirm: "確認用パスワードが一致していません。"
    });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${getBaseUrl()}/auth/callback`
    }
  });

  if (error) {
    const message = mapSignUpError(error.message);
    return buildErrorState({ ...values, email }, message, {
      email: message
    });
  }

  if (data.session) {
    redirect("/home");
  }

  return {
    status: "success",
    message: "アカウントを作成しました。確認メールが届いた場合は、メール認証後にログインしてください。",
    values: {
      email,
      password: "",
      passwordConfirm: ""
    }
  };
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}
