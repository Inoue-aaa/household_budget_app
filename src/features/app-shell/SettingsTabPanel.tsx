import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { signOutAction } from "@/features/auth/actions";
import { AccountSwitcherForm } from "@/features/account-switcher/AccountSwitcherForm";
import { ThemePreferenceForm } from "@/features/theme-preferences/ThemePreferenceForm";
import type { HouseholdAccountOption } from "@/lib/finance/types";
import type { AppThemeName } from "@/lib/theme/themes";

type SettingsTabPanelProps = {
  themeName: AppThemeName;
  userEmail: string | null;
  accounts: HouseholdAccountOption[];
  currentAccountId: string | null;
  onThemeSaved?: (themeName: AppThemeName) => void;
  onSwitchAccount?: (accountId: string) => Promise<{
    status: "success";
    accountId: string;
  } | {
    status: "error" | "unauthorized";
    message: string;
  }>;
};

export function SettingsTabPanel({
  themeName,
  userEmail,
  accounts,
  currentAccountId,
  onThemeSaved,
  onSwitchAccount,
}: SettingsTabPanelProps) {
  return (
    <div className="page-stack">
      <ScreenHeader
        eyebrow="Settings"
        title="設定"
        description="アカウント情報と表示カラーを確認できます。日々の使いやすさに合わせて整えてください。"
      />

      {accounts.length > 0 && currentAccountId ? (
        <SectionCard
          title="利用アカウント"
          description="使用する家計簿アカウントを選択できます。同じログイン内で3つのアカウントを切り替えて利用できます。"
        >
          <AccountSwitcherForm
            accounts={accounts}
            currentAccountId={currentAccountId}
            onSwitchAccount={onSwitchAccount}
          />
        </SectionCard>
      ) : null}

      <SectionCard
        title="アカウント"
        description="このアプリは自分専用のメールアドレスとパスワードでログインする前提です。"
      >
        <div className="list">
          <div className="list-row">
            <div>
              <p className="list-title">ログイン中のメールアドレス</p>
              <p className="list-meta">{userEmail ?? "未設定"}</p>
            </div>
            <span className="pill">Password</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="表示カラー"
        description="背景、カード、文字色、アクセント色をまとめて切り替えます。"
      >
        <ThemePreferenceForm currentTheme={themeName} onSavedTheme={onThemeSaved} />
      </SectionCard>

      <SectionCard title="セッション" description="現在のログイン状態をここから終了できます。">
        <form action={signOutAction}>
          <button className="button button-secondary" type="submit">
            ログアウト
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
