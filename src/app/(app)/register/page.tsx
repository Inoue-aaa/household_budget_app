import Link from "next/link";
import { NoticeBanner } from "@/components/NoticeBanner";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { getPendingImportsPageSnapshot } from "@/lib/finance/queries";
import { getRegisterNotice } from "@/lib/ui/notices";

type RegisterPageProps = {
  searchParams: Promise<{
    notice?: string;
  }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { notice } = await searchParams;
  const registerNotice = getRegisterNotice(notice);
  const pendingSnapshot = await getPendingImportsPageSnapshot();

  return (
    <div className="page-stack">
      {registerNotice ? (
        <NoticeBanner
          tone={registerNotice.tone}
          title={registerNotice.title}
          description={registerNotice.description}
        />
      ) : null}

      <ScreenHeader
        eyebrow="Register"
        title="登録方法"
        description="手入力、レシート、クレジット明細スクリーンショットの3つから支出を登録できます。"
      />

      <SectionCard
        title="支出を登録する"
        description="フェーズ1では入力後に review へ進み、内容を確認してから保存します。"
      >
        <div className="link-grid">
          <Link className="link-card" href="/register/manual">
            <strong>手入力で登録</strong>
            <span>日付、金額、内容、カテゴリを直接入力して保存します。</span>
          </Link>
          <Link className="link-card link-card-featured" href="/register/receipt">
            <strong>レシートを読み取る</strong>
            <span>画像から下書きを作成し、review 画面で確認してから保存します。</span>
          </Link>
          <Link className="link-card" href="/register/credit">
            <strong>クレジット明細を読み取る</strong>
            <span>スクリーンショットを明細単位で確認し、必要な修正後に保存します。</span>
          </Link>
        </div>
      </SectionCard>

      {pendingSnapshot.totalCount > 0 ? (
        <Link className="surface section-card section-card-link" href="/register/pending">
          <div className="section-card-link-header">
            <h2 className="section-title">未確認データ</h2>
            <span className="section-card-link-arrow" aria-hidden="true">
              ›
            </span>
          </div>
          <p className="section-copy">
            {pendingSnapshot.totalCount}件の取り込みがあります。review 画面へ戻って続きを確認できます。
          </p>
        </Link>
      ) : null}
    </div>
  );
}
