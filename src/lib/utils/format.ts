import type { SourceType } from "@/lib/finance/types";

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatMonthLabel(value: string | Date) {
  const date = typeof value === "string" ? new Date(`${value}T00:00:00`) : value;

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
  }).format(date);
}

export function formatSourceLabel(value: SourceType, recurringExpenseId?: string | null) {
  if (recurringExpenseId) {
    return "固定費";
  }

  switch (value) {
    case "manual":
      return "手入力";
    case "receipt":
      return "レシート";
    case "credit_screenshot":
      return "クレジット明細";
    default:
      return value;
  }
}

export function formatImportGroupHeading(value: SourceType, recurringExpenseId?: string | null) {
  if (recurringExpenseId) {
    return "固定費から追加した支出";
  }

  switch (value) {
    case "manual":
      return "手入力で登録した支出";
    case "receipt":
      return "レシートから登録した支出";
    case "credit_screenshot":
      return "クレジット明細から登録した支出";
    default:
      return "取り込み済みの支出";
  }
}

export function formatImportGroupDeleteLabel() {
  return "削除";
}

export function formatImportGroupDeleteConfirmation() {
  return "この取り込みに含まれる支出をまとめて削除しますか？";
}

export function formatImportGroupMetaLabel(value: SourceType, recurringExpenseId?: string | null) {
  if (recurringExpenseId) {
    return "登録方法";
  }

  switch (value) {
    case "manual":
      return "登録方法";
    case "receipt":
    case "credit_screenshot":
      return "取り込み元";
    default:
      return "種別";
  }
}

export function formatHistoryTitle(date: string, count: number) {
  return `${formatDisplayDate(date)}・${count}件`;
}

export function monthDateRange(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);

  return { start, end };
}

export function monthStartDateString(date: Date) {
  return monthDateRange(date).start;
}
