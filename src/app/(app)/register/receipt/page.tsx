import { BackButton } from "@/components/BackButton";
import { NoticeBanner } from "@/components/NoticeBanner";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { ReceiptUploadForm } from "@/features/receipt-upload/ReceiptUploadForm";
import { getUploadNotice } from "@/lib/ui/notices";
import {
  getOcrProviderMode,
  getOllamaOcrModel,
  getOpenAiApiKey,
  getOpenAiReceiptOcrModel,
} from "@/lib/utils/env";

type ReceiptRegisterPageProps = {
  searchParams: Promise<{
    notice?: string;
  }>;
};

export default async function ReceiptRegisterPage({
  searchParams,
}: ReceiptRegisterPageProps) {
  const { notice } = await searchParams;
  const uploadNotice = getUploadNotice("receipt", notice);
  const providerMode = getOcrProviderMode();
  const modelLabel =
    providerMode === "real"
      ? getOpenAiApiKey()
        ? getOpenAiReceiptOcrModel()
        : null
      : providerMode === "ollama_local"
      ? getOllamaOcrModel()
      : null;

  return (
    <div className="page-stack">
      <ScreenHeader
        eyebrow="Receipt"
        title="レシート登録"
        description="画像から確認用の下書きを作成し、確認画面で内容を調整してから保存します。"
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
        <ReceiptUploadForm />
        {modelLabel ? (
          <p className="caption">読み取りモデル: {modelLabel}</p>
        ) : null}
      </SectionCard>

      <div className="single-action-row">
        <BackButton
          className="button button-secondary compact-button action-button action-button-secondary bottom-back-button"
          fallbackHref="/register"
        />
      </div>
    </div>
  );
}
