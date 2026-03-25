import Link from "next/link";
import { NoticeBanner } from "@/components/NoticeBanner";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { CreditScreenshotUploadForm } from "@/features/credit-upload/CreditScreenshotUploadForm";
import { getUploadNotice } from "@/lib/ui/notices";
import {
  getOcrProviderMode,
  getOllamaOcrModel,
  getOpenAiApiKey,
  getOpenAiCreditOcrModel,
} from "@/lib/utils/env";

type CreditRegisterPageProps = {
  searchParams: Promise<{
    notice?: string;
  }>;
};

export default async function CreditRegisterPage({
  searchParams,
}: CreditRegisterPageProps) {
  const { notice } = await searchParams;
  const uploadNotice = getUploadNotice("credit_screenshot", notice);
  const providerMode = getOcrProviderMode();
  const modelLabel =
    providerMode === "real"
      ? getOpenAiApiKey()
        ? getOpenAiCreditOcrModel()
        : null
      : providerMode === "ollama_local"
      ? getOllamaOcrModel()
      : null;

  return (
    <div className="page-stack">
      <ScreenHeader
        eyebrow="Credit"
        title="クレジット明細登録"
        description="スクリーンショットを明細単位で確認し、必要な修正後に保存します。"
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
        description="1枚から3枚までの画像をまとめて送信してください。確認画面へ遷移します。"
      >
        <CreditScreenshotUploadForm />
        <p className="caption">読み取りモデル: {modelLabel ?? "gpt-4.1-mini"}</p>
      </SectionCard>

      <div className="single-action-row">
        <Link
          className="button button-secondary compact-button action-button action-button-secondary bottom-back-button"
          href="/register"
        >
          back
        </Link>
      </div>
    </div>
  );
}
