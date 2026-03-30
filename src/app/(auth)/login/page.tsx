import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/LoginForm";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAllowedUserEmail } from "@/lib/utils/env";

export default async function LoginPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/home");
  }

  const allowedEmail = getAllowedUserEmail();

  return (
    <main className="auth-shell">
      <section className="surface auth-card">
        <p className="eyebrow">Sign In</p>
        <h1 className="screen-title">ログイン</h1>
        <p className="screen-description">
          メールアドレスとパスワードでログインします。スマホでも安定して使えるように、Magic
          Link ではなく通常のパスワード認証へ切り替えています。
        </p>
        {allowedEmail ? (
          <p className="caption">利用できるメールアドレス: {allowedEmail}</p>
        ) : null}
        <div style={{ height: 20 }} />
        <LoginForm />
      </section>
    </main>
  );
}
