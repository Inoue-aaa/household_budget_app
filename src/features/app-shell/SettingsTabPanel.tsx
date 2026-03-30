import Link from "next/link";
import { Landmark } from "lucide-react";
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
  onSwitchAccount?: (accountId: string) => Promise<
    | {
        status: "success";
        accountId: string;
      }
    | {
        status: "error" | "unauthorized";
        message: string;
      }
  >;
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
    <div className="page-stack tab-panel-stack">
      <ScreenHeader
        eyebrow="Settings"
        title="設定"
        description="アカウント情報と表示カラーを設定できます。"
      />

      {accounts.length > 0 && currentAccountId ? (
        <SectionCard
          title="利用アカウント"
          description="アカウントを切り替えられます。"
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
        description="プライベート使用前提仕様です。"
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
        description="表示モードとアクセントを組み合わせて調整できます。"
      >
        <ThemePreferenceForm
          currentTheme={themeName}
          onSavedTheme={onThemeSaved}
        />
      </SectionCard>

      <Link
        className="surface section-card section-card-link settings-utility-link"
        href="/home/budget"
      >
        <div className="section-card-link-header">
          <div className="home-quick-action-title">
            <span className="settings-section-icon" aria-hidden="true">
              <Landmark size={16} />
            </span>
            <h2 className="section-title">予算設定</h2>
          </div>
          <span className="section-card-link-arrow" aria-hidden="true">
            ›
          </span>
        </div>
        <p className="section-copy">
          予算額と対象カテゴリを見直したいときは、ここからすぐに移動できます。
        </p>
      </Link>

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
