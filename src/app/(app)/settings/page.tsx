import { NoticeBanner } from "@/components/NoticeBanner";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { signOutAction } from "@/features/auth/actions";
import { ThemePreferenceForm } from "@/features/theme-preferences/ThemePreferenceForm";
import { getCurrentThemePreference } from "@/lib/preferences/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function getSettingsNotice(code?: string) {
  switch (code) {
    case "theme_saved":
      return {
        tone: "success" as const,
        title: "表示カラーを保存しました",
        description: "次回以降も同じテーマで表示されます。"
      };
    case "theme_error":
      return {
        tone: "info" as const,
        title: "表示カラーを保存できませんでした",
        description: "時間をおいてから、もう一度お試しください。"
      };
    default:
      return null;
  }
}

type SettingsPageProps = {
  searchParams?: Promise<{
    notice?: string;
  }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const supabase = await createServerSupabaseClient();
  const [
    {
      data: { user }
    },
    currentTheme
  ] = await Promise.all([supabase.auth.getUser(), getCurrentThemePreference()]);
  const params = searchParams ? await searchParams : undefined;
  const notice = getSettingsNotice(params?.notice);

  return (
    <div className="page-stack">
      {notice ? (
        <NoticeBanner
          description={notice.description}
          title={notice.title}
          tone={notice.tone}
        />
      ) : null}

      <ScreenHeader
        eyebrow="Settings"
        title="設定"
        description="アカウント情報と表示カラーを確認できます。日々の使いやすさに合わせて整えてください。"
      />

      <SectionCard
        title="アカウント"
        description="このアプリは自分専用のメールアドレスでログインする前提です。"
      >
        <div className="list">
          <div className="list-row">
            <div>
              <p className="list-title">ログイン中のメールアドレス</p>
              <p className="list-meta">{user?.email ?? "未取得"}</p>
            </div>
            <span className="pill">Magic Link</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="表示カラー"
        description="背景、カード、文字色、アクセント色をまとめて切り替えます。"
      >
        <ThemePreferenceForm currentTheme={currentTheme} />
      </SectionCard>

      <SectionCard
        title="セッション"
        description="現在のログイン状態をここから終了できます。"
      >
        <form action={signOutAction}>
          <button className="button button-secondary" type="submit">
            ログアウト
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
