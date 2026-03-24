import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/LoginForm";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/home");
  }

  return (
    <main className="auth-shell">
      <section className="surface auth-card">
        <p className="eyebrow">Sign In</p>
        <h1 className="screen-title">個人用家計簿</h1>
        <p className="screen-description">
          ご自身のメールアドレスにログイン用リンクを送信します。
          フェーズ1では Magic Link を入口にして、後から passkey に拡張しやすい形にしています。
        </p>
        <div style={{ height: 20 }} />
        <LoginForm />
      </section>
    </main>
  );
}
