import Link from "next/link";
import { Pencil, ScanLine, CreditCard, AlertCircle, Repeat2 } from "lucide-react";
import { NoticeBanner } from "@/components/NoticeBanner";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { RecurringExpenseCandidatesSection } from "@/features/fixed-expenses/RecurringExpenseCandidatesSection";
import type { PendingImportsPageSnapshot } from "@/lib/finance/types";
import { getRegisterNotice } from "@/lib/ui/notices";

type RegisterTabPanelProps = {
  snapshot: PendingImportsPageSnapshot;
  noticeCode?: string;
};

export function RegisterTabPanel({
  snapshot,
  noticeCode,
}: RegisterTabPanelProps) {
  const registerNotice = getRegisterNotice(noticeCode);

  return (
    <div className="page-stack tab-panel-stack">
      {registerNotice ? (
        <NoticeBanner
          tone={registerNotice.tone}
          title={registerNotice.title}
          description={registerNotice.description}
        />
      ) : null}

      <ScreenHeader
        eyebrow="Register"
        title="登録"
        description="支出を登録できます。手入力や画像読み取りから保存できます。"
      />

      <SectionCard title="支出を登録する">
        <div className="link-grid">
          <Link className="link-card link-card-manual" href="/register/manual">
            <div className="link-card-icon link-card-icon-neutral">
              <Pencil size={19} />
            </div>
            <div className="link-card-body">
              <strong>手入力で登録</strong>
              <span>日付、金額、内容、カテゴリを直接入力して保存します。</span>
            </div>
          </Link>

          <Link
            className="link-card link-card-featured link-card-ocr"
            href="/register/receipt"
          >
            <div className="link-card-icon link-card-icon-accent">
              <ScanLine size={19} />
            </div>
            <div className="link-card-body">
              <strong>レシートを読み取る</strong>
              <span>画像から下書きを作成し、確認画面で修正してから保存します。</span>
            </div>
          </Link>

          <Link className="link-card link-card-credit" href="/register/credit">
            <div className="link-card-icon link-card-icon-soft">
              <CreditCard size={19} />
            </div>
            <div className="link-card-body">
              <strong>クレジット明細を読み取る</strong>
              <span>
                スクリーンショットを明細単位で確認し、必要な修正後に保存します。
              </span>
            </div>
          </Link>

          <Link className="link-card link-card-manual" href="/register/fixed/list">
            <div className="link-card-icon link-card-icon-neutral">
              <Repeat2 size={19} />
            </div>
            <div className="link-card-body">
              <strong>固定費 / サブスク登録</strong>
              <span>毎月発生する支出を登録し、反映日と時刻を設定できます。</span>
            </div>
          </Link>
        </div>
      </SectionCard>

      <RecurringExpenseCandidatesSection items={snapshot.recurringExpenseCandidates} />

      {snapshot.totalCount > 0 ? (
        <Link
          className="surface section-card section-card-link register-warning-card"
          href="/register/pending"
        >
          <div className="section-card-link-header">
            <div className="home-quick-action-title">
              <span className="register-warning-icon" aria-hidden="true">
                <AlertCircle size={17} />
              </span>
              <h2 className="section-title">未登録データ</h2>
            </div>
            <span className="section-card-link-arrow" aria-hidden="true">
              ›
            </span>
          </div>
          <p className="section-copy">
            登録が中断されたデータが{snapshot.totalCount}件あります。確認画面へ戻り処理を続けることができます。
          </p>
        </Link>
      ) : null}
    </div>
  );
}
