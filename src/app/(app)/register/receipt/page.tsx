import { NoticeBanner } from "@/components/NoticeBanner";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { ReceiptUploadForm } from "@/features/receipt-upload/ReceiptUploadForm";
import { getUploadNotice } from "@/lib/ui/notices";
import { getOcrProviderMode, getOllamaBaseUrl, getOpenAiApiKey } from "@/lib/utils/env";

type ReceiptRegisterPageProps = {
  searchParams: Promise<{
    notice?: string;
  }>;
};

export default async function ReceiptRegisterPage({ searchParams }: ReceiptRegisterPageProps) {
  const { notice } = await searchParams;
  const uploadNotice = getUploadNotice("receipt", notice);
  const providerMode = getOcrProviderMode();
  const hasApiKey = Boolean(getOpenAiApiKey());
  const ollamaBaseUrl = getOllamaBaseUrl();
  const debugDescription =
    providerMode === "real"
      ? hasApiKey
        ? "現在は real OCR で receipt provider を利用します。読み取り後はそのまま review へ進みます。"
        : "現在は real OCR が選択されていますが、OPENAI_API_KEY が未設定です。upload は review へ進まず、設定不足として戻ります。"
      : providerMode === "ollama_local"
        ? `現在は Ollama local OCR を利用します。接続先: ${ollamaBaseUrl}`
      : "現在は dummy OCR です。実画像でもダミー行が返るため、real OCR を使う場合は OCR_PROVIDER_MODE=real を設定してください。";

  return (
    <div className="page-stack">
      <ScreenHeader
        eyebrow="Receipt"
        title="レシート登録"
        description="画像から確認前データを作成し、review 画面で確認してから保存します。"
      />

      <NoticeBanner
        title={`現在の OCR mode: ${providerMode}`}
        description={debugDescription}
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
        description="1枚から3枚までの画像をまとめて処理し、expense_drafts を作成して review 画面へ進みます。"
      >
        <ReceiptUploadForm />
      </SectionCard>
    </div>
  );
}
