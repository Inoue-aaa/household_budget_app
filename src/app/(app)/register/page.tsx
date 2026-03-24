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
        description="手入力、レシート、クレジット明細スクリーンショットの3つから登録できます。"
      />

      <SectionCard
        title="未確認データ"
        description="確認途中の取り込みはここから再開できます。ホームからは外し、登録タブにまとめました。"
      >
        <Link className="link-card" href="/register/pending">
          <strong>未確認データを開く</strong>
          <span>
            {pendingSnapshot.totalCount > 0
              ? `${pendingSnapshot.totalCount}件の取り込みが確認待ちです。review 画面へ戻って内容を整えられます。`
              : "現在、確認待ちの取り込みはありません。新しい読み取り結果ができると、ここから再開できます。"}
          </span>
        </Link>
      </SectionCard>

      <SectionCard
        title="支出を登録する"
        description="フェーズ1では、手入力と画像取り込みを import_group 単位で review してから保存します。"
      >
        <div className="link-grid">
          <Link className="link-card" href="/register/manual">
            <strong>手入力で登録</strong>
            <span>日付、店舗名、内容、金額、カテゴリを直接入力して保存します。</span>
          </Link>
          <Link className="link-card link-card-featured" href="/register/receipt">
            <strong>レシートを読み取る</strong>
            <span>画像から候補を作成し、review 画面で確認してから保存します。</span>
          </Link>
          <Link className="link-card" href="/register/credit">
            <strong>クレジット明細を読み取る</strong>
            <span>スクリーンショットを明細単位で確認し、内容を整えてから保存します。</span>
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
