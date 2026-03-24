import { NoticeBanner } from "@/components/NoticeBanner";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { CreditScreenshotUploadForm } from "@/features/credit-upload/CreditScreenshotUploadForm";
import { getUploadNotice } from "@/lib/ui/notices";

type CreditRegisterPageProps = {
  searchParams: Promise<{
    notice?: string;
  }>;
};

export default async function CreditRegisterPage({ searchParams }: CreditRegisterPageProps) {
  const { notice } = await searchParams;
  const uploadNotice = getUploadNotice("credit_screenshot", notice);

  return (
    <div className="page-stack">
      <ScreenHeader
        eyebrow="Credit"
        title="クレジット明細登録"
        description="スクリーンショットから明細候補を作成し、review 画面で整えてから保存します。"
      />

      <NoticeBanner
        title="1明細を1支出として扱います"
        description="フェーズ1では商品単位への分解は行わず、そのまま review で確認する構成です。"
      />

      {uploadNotice ? (
        <NoticeBanner
          tone={uploadNotice.tone}
          title={uploadNotice.title}
          description={uploadNotice.description}
        />
      ) : null}

      <SectionCard
        title="画像を取り込む"
        description="画像をまとめて処理し、credit_screenshot の draft を作成して review 画面へ進みます。"
      >
        <CreditScreenshotUploadForm />
      </SectionCard>
    </div>
  );
}
