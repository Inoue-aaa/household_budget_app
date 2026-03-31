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

export type RegisterNoticeCode = "group-discarded" | "fixed-expense-created";
export type PendingNoticeCode = "deleted" | "delete_error";
export type ExpensesNoticeCode = "created" | "deleted" | "delete_error";

function uploadSourceLabel(sourceType: Extract<SourceType, "receipt" | "credit_screenshot">) {
  return sourceType === "receipt" ? "レシート画像" : "クレジット明細画像";
}

function uploadSubjectLabel(sourceType: Extract<SourceType, "receipt" | "credit_screenshot">) {
  return sourceType === "receipt" ? "レシート" : "クレジット明細";
}

export function getUploadNotice(
  sourceType: Extract<SourceType, "receipt" | "credit_screenshot">,
  code?: string
): NoticeConfig | null {
  if (!code) {
    return null;
  }

  const sourceLabel = uploadSourceLabel(sourceType);
  const subjectLabel = uploadSubjectLabel(sourceType);

  const map: Partial<Record<UploadReviewErrorCode, NoticeConfig>> = {
    "missing-files": {
      title: `${sourceLabel}を選択してください`,
      description: `1枚から3枚までの${sourceLabel}を選んでから、読み取りを開始してください。`
    },
    "too-many-files": {
      title: "画像は3枚までです",
      description: `${subjectLabel}の読み取りは、1回につき3枚までにしています。枚数を減らしてから再度お試しください。`
    },
    "invalid-file": {
      title: "対応していないファイル形式です",
      description:
        "画像ファイルのみ読み取りに対応しています。ファイル形式を確認して、もう一度お試しください。"
    },
    "unsupported-heic": {
      title: "HEIC / HEIF 画像はまだ未対応です",
      description:
        "iPhone の写真を JPEG または PNG に変換してから、もう一度お試しください。"
    },
    "ocr-provider-unavailable": {
      title: "OCR を利用できませんでした",
      description: `${subjectLabel}用の OCR provider が利用できない状態です。設定を確認してから再度お試しください。`
    },
    "ocr-api-key-missing": {
      title: "OCR の設定が未完了です",
      description:
        "必要な API キーが設定されていないため、読み取りを開始できませんでした。設定内容を確認してください。"
    },
    "ocr-request-failed": {
      title: "読み取り処理に失敗しました",
      description: "OCR サービスへの接続で失敗しました。時間をおいてから、もう一度お試しください。"
    },
    "ocr-parse-failed": {
      title: "読み取り結果を整形できませんでした",
      description: "画像から結果は返りましたが、確認画面用の形に整えられませんでした。別の画像でもお試しください。"
    },
    "ocr-timeout": {
      title: "読み取りに時間がかかりすぎています",
      description: "処理時間の上限に達しました。枚数を減らすか、鮮明な画像で再度お試しください。"
    },
    "ocr-empty": {
      title: "支出候補を見つけられませんでした",
      description: `${sourceLabel}から確認用の候補を作れませんでした。画像を変えて再度お試しください。`
    },
    "create-error": {
      title: "確認データの作成に失敗しました",
      description: "取り込み途中で保存に失敗しました。時間をおいてから再度お試しください。"
    }
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
      description: "内容とカテゴリ、金額を確認してから保存してください。"
    },
    "upload-created": {
      tone: "success",
      title: "読み取り結果を確認画面に反映しました",
      description: "必要な行だけ残し、内容を整えてから保存してください。"
    },
    "row-added": {
      tone: "success",
      title: "行を追加しました",
      description: "不足している明細を追加して、内容を入力してください。"
    },
    "row-saved": {
      tone: "success",
      title: "行を保存しました",
      description: "この行の変更を確認データに反映しました。"
    },
    "row-deleted": {
      tone: "success",
      title: "行を削除しました",
      description: "不要な候補を確認データから取り除きました。"
    },
    "row-invalid": {
      title: "入力内容を確認してください",
      description: "保存前に不足している項目があります。"
    },
    "row-save-error": {
      title: "行を保存できませんでした",
      description: "時間をおいてから再度お試しください。"
    },
    "confirm-error": {
      title: "確定保存に失敗しました",
      description: "未入力の行がないか確認してから、もう一度お試しください。"
    },
    "discard-error": {
      title: "取り込みを破棄できませんでした",
      description: "時間をおいてから再度お試しください。"
    }
  };

  return map[code as ReviewNoticeCode] ?? null;
}

export function getRegisterNotice(code?: string): NoticeConfig | null {
  const map: Record<RegisterNoticeCode, NoticeConfig> = {
    "group-discarded": {
      tone: "success",
      title: "取り込みを破棄しました",
      description: "未確定の確認データをまとめて削除しました。",
    },
    "fixed-expense-created": {
      tone: "success",
      title: "固定費を保存しました",
      description: "毎月の固定費 / サブスク設定を登録しました。",
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
      title: "未確認データを削除しました",
      description: "この取り込みに含まれる draft データをまとめて削除しました。"
    },
    delete_error: {
      title: "削除できませんでした",
      description: "時間をおいてから再度お試しください。"
    }
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
      description: "保存した内容を登録履歴に反映しました。"
    },
    deleted: {
      tone: "success",
      title: "取り込み単位を削除しました",
      description: "この取り込みに含まれる保存済み支出をまとめて削除しました。"
    },
    delete_error: {
      title: "削除できませんでした",
      description: "時間をおいてから再度お試しください。"
    }
  };

  return map[code as ExpensesNoticeCode] ?? null;
}
