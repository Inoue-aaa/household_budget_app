import type { UploadReviewErrorCode } from "@/features/import-review/upload-review-service";
import type { SourceType } from "@/lib/finance/types";

export type NoticeTone = "info" | "success";

export type NoticeConfig = {
  tone?: NoticeTone;
  title: string;
  description: string;
};

export type ReviewNoticeCode =
  | "dummy-created"
  | "upload-created"
  | "row-added"
  | "row-saved"
  | "row-deleted"
  | "row-invalid"
  | "row-save-error"
  | "confirm-error"
  | "discard-error";

export type RegisterNoticeCode =
  | "group-discarded"
  | "fixed-expense-created"
  | "fixed-expense-hidden";
export type PendingNoticeCode = "deleted" | "delete_error";
export type ExpensesNoticeCode = "created" | "deleted" | "delete_error";

function uploadSourceLabel(sourceType: Extract<SourceType, "receipt" | "credit_screenshot">) {
  return sourceType === "receipt" ? "レシート" : "クレジット明細画像";
}

function uploadSubjectLabel(sourceType: Extract<SourceType, "receipt" | "credit_screenshot">) {
  return sourceType === "receipt" ? "レシート" : "クレジット明細";
}

export function getUploadNotice(
  sourceType: Extract<SourceType, "receipt" | "credit_screenshot">,
  code?: string,
): NoticeConfig | null {
  if (!code) {
    return null;
  }

  const sourceLabel = uploadSourceLabel(sourceType);
  const subjectLabel = uploadSubjectLabel(sourceType);

  const map: Partial<Record<UploadReviewErrorCode, NoticeConfig>> = {
    "missing-files": {
      title: `${sourceLabel}を選択してください`,
      description: `1枚から3枚までの${sourceLabel}を選んでから、読み取りを開始してください。`,
    },
    "too-many-files": {
      title: "画像は3枚までです",
      description: `${subjectLabel}の読み取りは、一度に3枚までにしてください。枚数を減らしてから再度お試しください。`,
    },
    "invalid-file": {
      title: "対応していないファイル形式です",
      description: "画像ファイルのみ読み取りに対応しています。形式を確認して、もう一度お試しください。",
    },
    "unsupported-heic": {
      title: "HEIC / HEIF 画像はまだ未対応です",
      description: "iPhone の写真を JPEG または PNG に変換してから、もう一度お試しください。",
    },
    "ocr-provider-unavailable": {
      title: "OCR を利用できませんでした",
      description: `${subjectLabel}用の OCR provider が利用できない状態です。設定を確認してから再度お試しください。`,
    },
    "ocr-api-key-missing": {
      title: "OCR の設定が未完了です",
      description:
        "必要な API キーが設定されていないため、読み取りを開始できません。設定内容を確認してください。",
    },
    "ocr-request-failed": {
      title: "読み取り処理に失敗しました",
      description: "OCR サービスへの接続で失敗しました。時間をおいてから、もう一度お試しください。",
    },
    "ocr-parse-failed": {
      title: "読み取り結果を整形できませんでした",
      description: "画像からの抽出はありましたが、確認画面用の形に整えられませんでした。別の画像でもお試しください。",
    },
    "ocr-timeout": {
      title: "読み取りに時間がかかりすぎています",
      description: "処理が長引いているため中断しました。枚数を減らすか、別の画像で再度お試しください。",
    },
    "ocr-empty": {
      title: "読み取り候補を見つけられませんでした",
      description: `${sourceLabel}から確認用の候補を作れませんでした。画像を変えて再度お試しください。`,
    },
    "create-error": {
      title: "確認データの作成に失敗しました",
      description: "取り込み処理の保存に失敗しました。時間をおいてから再度お試しください。",
    },
  };

  return map[code as UploadReviewErrorCode] ?? null;
}

export function getReviewNotice(code?: string): NoticeConfig | null {
  if (!code) {
    return null;
  }

  const map: Record<ReviewNoticeCode, NoticeConfig> = {
    "dummy-created": {
      tone: "success",
      title: "確認用データを作成しました",
      description: "内容とカテゴリ、金額を確認してから保存してください。",
    },
    "upload-created": {
      tone: "success",
      title: "読み取り結果を確認画面に反映しました",
      description: "必要な箇所を修正してから保存してください。",
    },
    "row-added": {
      tone: "success",
      title: "明細を追加しました",
      description: "追加した明細を確認して、必要なら修正してください。",
    },
    "row-saved": {
      tone: "success",
      title: "明細を保存しました",
      description: "この明細の変更を確認データに反映しました。",
    },
    "row-deleted": {
      tone: "success",
      title: "明細を削除しました",
      description: "不要な候補を確認データから削除しました。",
    },
    "row-invalid": {
      title: "入力内容を確認してください",
      description: "保存に必要な項目が足りません。",
    },
    "row-save-error": {
      title: "明細を保存できませんでした",
      description: "時間をおいてから再度お試しください。",
    },
    "confirm-error": {
      title: "保存に失敗しました",
      description: "未入力の項目がないか確認してから、もう一度お試しください。",
    },
    "discard-error": {
      title: "取り込みを削除できませんでした",
      description: "時間をおいてから再度お試しください。",
    },
  };

  return map[code as ReviewNoticeCode] ?? null;
}

export function getRegisterNotice(code?: string): NoticeConfig | null {
  if (code === "fixed-expense-added") {
    return {
      tone: "success",
      title: "固定費を追加しました",
      description: "今月の支出として固定費を追加しました。",
    };
  }

  if (code === "fixed-expense-already-added") {
    return {
      title: "この月には追加済みです",
      description: "選択した固定費は、対象月の支出としてすでに追加されています。",
    };
  }

  if (code === "fixed-expense-add-error") {
    return {
      title: "固定費の追加に失敗しました",
      description: "時間をおいてから、もう一度お試しください。",
    };
  }

  if (code === "fixed-expense-hidden") {
    return {
      tone: "success",
      title: "固定費候補を非表示にしました",
      description: "この候補は次の発生月まで表示されません。",
    };
  }

  const map: Partial<Record<RegisterNoticeCode, NoticeConfig>> = {
    "group-discarded": {
      tone: "success",
      title: "取り込みを削除しました",
      description: "未登録の確認データをまとめて削除しました。",
    },
    "fixed-expense-created": {
      tone: "success",
      title: "固定費を保存しました",
      description: "登録済みの固定費 / サブスク設定を保存しました。",
    },
  };

  return code ? map[code as RegisterNoticeCode] ?? null : null;
}

export function getPendingNotice(code?: string): NoticeConfig | null {
  if (!code) {
    return null;
  }

  const map: Record<PendingNoticeCode, NoticeConfig> = {
    deleted: {
      tone: "success",
      title: "未登録データを削除しました",
      description: "この取り込みに含まれる draft データをまとめて削除しました。",
    },
    delete_error: {
      title: "削除できませんでした",
      description: "時間をおいてから再度お試しください。",
    },
  };

  return map[code as PendingNoticeCode] ?? null;
}

export function getExpensesNotice(code?: string): NoticeConfig | null {
  if (!code) {
    return null;
  }

  const map: Record<ExpensesNoticeCode, NoticeConfig> = {
    created: {
      tone: "success",
      title: "支出を保存しました",
      description: "保存した内容を一覧に反映しました。",
    },
    deleted: {
      tone: "success",
      title: "支出を削除しました",
      description: "不要な支出を一覧から削除しました。",
    },
    delete_error: {
      title: "削除できませんでした",
      description: "時間をおいてから再度お試しください。",
    },
  };

  return map[code as ExpensesNoticeCode] ?? null;
}
