import { redirect } from "next/navigation";
import { SignUpForm } from "@/features/auth/SignUpForm";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAllowedUserEmail } from "@/lib/utils/env";

export default async function SignUpPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/app?tab=home");
  }

  const allowedEmail = getAllowedUserEmail();

  return (
    <main className="auth-shell">
      <section className="surface auth-card">
        <p className="eyebrow">Create Account</p>
        <h1 className="screen-title">アカウント作成</h1>
        <p className="screen-description">
          最初にメールアドレスとパスワードを登録します。以後は同じ組み合わせでログインできます。
        </p>
        {allowedEmail ? (
          <p className="caption">登録できるメールアドレス: {allowedEmail}</p>
        ) : null}
        <div style={{ height: 20 }} />
        <SignUpForm defaultEmail={allowedEmail} />
      </section>
    </main>
  );
}
