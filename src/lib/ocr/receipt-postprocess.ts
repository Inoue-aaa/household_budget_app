import type { OcrExtractionLine } from "@/lib/ocr/types";

export type ReceiptAiItemKind =
  | "item"
  | "subtotal"
  | "tax"
  | "total"
  | "tendered"
  | "change"
  | "unknown";

export type ReceiptAiCategoryHint =
  | "food"
  | "daily_goods"
  | "medicine"
  | "beauty"
  | "clothing"
  | "other";

export type ReceiptAiItem = {
  name?: string | null;
  title: string | null;
  amount: number | string | null;
  kind: ReceiptAiItemKind;
  rawText: string | null;
  quantity?: number | string | null;
  unitPrice?: number | string | null;
  originalAmount?: number | string | null;
  discountAmount?: number | string | null;
  finalAmount?: number | string | null;
  categoryHint?: ReceiptAiCategoryHint | null;
  confidence?: number | string | null;
};

export type ReceiptUnknownRow = {
  rawText: string | null;
  reason?: string | null;
  amount?: number | string | null;
};

export type ReceiptAiResult = {
  merchantName: string | null;
  occurredOn: string | null;
  items: ReceiptAiItem[];
  rawText?: string | null;
  unknownRows?: ReceiptUnknownRow[] | null;
};

type NormalizedReceiptItem = {
  index: number;
  merchantName: string | null;
  occurredOn: string | null;
  title: string | null;
  amount: number | null;
  originalAmount: number | null;
  discountAmount: number | null;
  finalAmount: number | null;
  quantity: number | null;
  unitPrice: number | null;
  categoryHint: ReceiptAiCategoryHint | null;
  confidence: number | null;
  kind: ReceiptAiItemKind;
  rawText: string | null;
  itemScore: number;
  rightEdgeAmountLike: boolean;
  discountLabels: string[];
  absorbedDiscountRows: string[];
  isDiscountLike: boolean;
};

export const RECEIPT_DISCOUNT_KEYWORDS = [
  "会員様割引",
  "会員値引",
  "値引",
  "割引",
  "特売",
  "クーポン",
  "coupon"
] as const;

const EXCLUDED_TITLE_KEYWORDS = [
  "レシート",
  "領収書",
  "shop",
  "store",
  "tel",
  "電話",
  "ありがとうございます",
  "thank you",
  "barcode",
  "jan",
  "receipt",
  "no."
] as const;

const NON_ITEM_KINDS: ReceiptAiItemKind[] = ["subtotal", "tax", "total", "tendered", "change"];

function normalizeWhitespace(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() || null;
}

function containsKeyword(value: string | null, keywords: readonly string[]) {
  if (!value) {
    return false;
  }

  const lower = value.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
}

function hasRightEdgeAmount(value: string | null) {
  if (!value) {
    return false;
  }

  return /[-−ー]?\s*[¥￥]?\s*\d[\d,]*\s*$/.test(value);
}

function parseNumberString(value: string) {
  const normalized = value.replace(/[¥￥,\s]/g, "").replace(/[−ー]/g, "-");
  if (!normalized || normalized === "-") {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSignedAmount(value: number | string | null | undefined, rawText?: string | null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const parsed = parseNumberString(value);
    if (parsed != null) {
      return Math.round(parsed);
    }
  }

  const normalizedRawText = normalizeWhitespace(rawText);
  if (!normalizedRawText) {
    return null;
  }

  const matches = normalizedRawText.match(/[-−ー]?\s*[¥￥]?\s*\d[\d,]*/g);
  if (!matches || matches.length === 0) {
    return null;
  }

  const lastMatch = matches[matches.length - 1];
  if (!lastMatch) {
    return null;
  }

  const parsed = parseNumberString(lastMatch);
  return parsed == null ? null : Math.round(parsed);
}

function normalizePositiveAmount(value: number | string | null | undefined) {
  const parsed = parseSignedAmount(value);
  if (parsed == null) {
    return null;
  }

  return parsed > 0 ? parsed : null;
}

function stripTrailingAmount(value: string) {
  return value
    .replace(/[-−ー]?\s*[¥￥]?\s*\d[\d,]*\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isNoiseTitle(value: string | null) {
  if (!value) {
    return true;
  }

  if (containsKeyword(value, EXCLUDED_TITLE_KEYWORDS)) {
    return true;
  }

  if (/^\d+$/.test(value)) {
    return true;
  }

  if (/^\d{2}:\d{2}/.test(value)) {
    return true;
  }

  if (/^tel[:\s]?\d/i.test(value)) {
    return true;
  }

  if (/\d{2,4}-\d{2,4}-\d{3,4}/.test(value)) {
    return true;
  }

  return false;
}

function cleanTitle(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  const cleaned = stripTrailingAmount(normalized) || null;
  if (!cleaned || isNoiseTitle(cleaned)) {
    return null;
  }

  return cleaned;
}

function deriveTitleCandidate(item: ReceiptAiItem) {
  const explicitTitle = cleanTitle(item.name) ?? cleanTitle(item.title);
  if (explicitTitle) {
    return explicitTitle;
  }

  const rawText = normalizeWhitespace(item.rawText);
  if (!rawText) {
    return null;
  }

  const leftMatch = rawText.match(/^(.*?)(?:[-−ー]?\s*[¥￥]?\s*\d[\d,]*)\s*$/);
  if (leftMatch?.[1]) {
    const leftTitle = cleanTitle(leftMatch[1]);
    if (leftTitle) {
      return leftTitle;
    }
  }

  return cleanTitle(rawText);
}

function scoreItemCandidate(input: {
  title: string | null;
  amount: number | null;
  rawText: string | null;
  kind: ReceiptAiItemKind;
  rightEdgeAmountLike: boolean;
}) {
  let score = 0;

  if (input.kind === "item") {
    score += 4;
  } else if (input.kind === "unknown") {
    score += 1;
  }

  if (input.amount && input.amount > 0) {
    score += 2;
  }

  if (input.title && input.title.length >= 2) {
    score += 2;
  }

  if (input.title && input.title.length >= 3 && input.title.length <= 24) {
    score += 2;
  }

  if (input.title && /[ぁ-んァ-ヴ一-龠A-Za-z]/.test(input.title)) {
    score += 2;
  }

  if (input.rightEdgeAmountLike) {
    score += 2;
  }

  if (input.rawText && hasRightEdgeAmount(input.rawText)) {
    score += 1;
  }

  return score;
}

function normalizeItems(result: ReceiptAiResult) {
  return result.items.map((item, index) => {
    const rawText = normalizeWhitespace(item.rawText);
    const title = deriveTitleCandidate(item);
    const amount = parseSignedAmount(item.amount, rawText);
    const originalAmount = normalizePositiveAmount(item.originalAmount ?? item.amount);
    const discountAmount = parseSignedAmount(item.discountAmount, rawText);
    const finalAmount = parseSignedAmount(item.finalAmount, rawText);
    const normalizedAmount = finalAmount ?? amount;
    const isDiscountLike =
      Boolean(normalizedAmount && normalizedAmount < 0) &&
      (containsKeyword(title, RECEIPT_DISCOUNT_KEYWORDS) ||
        containsKeyword(rawText, RECEIPT_DISCOUNT_KEYWORDS));
    const rightEdgeAmountLike = hasRightEdgeAmount(rawText);

    return {
      index,
      merchantName: normalizeWhitespace(result.merchantName),
      occurredOn: normalizeWhitespace(result.occurredOn),
      title,
      amount: normalizedAmount,
      originalAmount,
      discountAmount,
      finalAmount,
      quantity: normalizePositiveAmount(item.quantity),
      unitPrice: normalizePositiveAmount(item.unitPrice),
      categoryHint: item.categoryHint ?? null,
      confidence:
        typeof item.confidence === "number"
          ? item.confidence
          : typeof item.confidence === "string"
            ? Number(item.confidence)
            : null,
      kind: item.kind,
      rawText,
      itemScore: scoreItemCandidate({
        title,
        amount: normalizedAmount,
        rawText,
        kind: item.kind,
        rightEdgeAmountLike
      }),
      rightEdgeAmountLike,
      discountLabels: isDiscountLike && title ? [title] : [],
      absorbedDiscountRows: [],
      isDiscountLike
    } satisfies NormalizedReceiptItem;
  });
}

function canMergeDiscountInto(target: NormalizedReceiptItem) {
  if (target.isDiscountLike) {
    return false;
  }

  if (NON_ITEM_KINDS.includes(target.kind)) {
    return false;
  }

  return Boolean(target.title && (target.finalAmount ?? target.amount ?? 0) > 0);
}

function absorbDiscountRows(rows: NormalizedReceiptItem[]) {
  const merged: NormalizedReceiptItem[] = [];

  for (const row of rows) {
    if (!row.isDiscountLike) {
      merged.push(row);
      continue;
    }

    const target = [...merged].reverse().find(canMergeDiscountInto);

    if (!target || row.amount == null || row.amount >= 0) {
      // Cannot absorb amount, but still preserve the discount label on the nearest product
      if (target && row.title) {
        target.discountLabels = [
          ...target.discountLabels,
          ...(target.discountLabels.includes(row.title) ? [] : [row.title])
        ];
      }
      merged.push({
        ...row,
        kind: "unknown"
      });
      continue;
    }

    const targetBaseAmount = target.originalAmount ?? target.finalAmount ?? target.amount ?? null;
    if (targetBaseAmount == null || targetBaseAmount <= 0) {
      // Cannot absorb amount, but still preserve the discount label on the nearest product
      if (row.title) {
        target.discountLabels = [
          ...target.discountLabels,
          ...(target.discountLabels.includes(row.title) ? [] : [row.title])
        ];
      }
      merged.push({
        ...row,
        kind: "unknown"
      });
      continue;
    }

    const accumulatedDiscount = (target.discountAmount ?? 0) + row.amount;
    target.originalAmount = target.originalAmount ?? targetBaseAmount;
    target.discountAmount = accumulatedDiscount;
    target.finalAmount = target.originalAmount + accumulatedDiscount;
    target.amount = target.finalAmount;
    target.discountLabels = [
      ...target.discountLabels,
      ...(row.title ? [row.title] : []),
      ...(row.rawText && row.rawText !== row.title ? [row.rawText] : [])
    ].filter((value, index, list) => list.indexOf(value) === index);

    if (row.rawText) {
      target.absorbedDiscountRows.push(row.rawText);
    }
  }

  return merged;
}

function buildFallbackTitle(merchantName: string | null, hasProductHint: boolean) {
  if (merchantName && hasProductHint) {
    return `${merchantName} 明細`;
  }

  if (merchantName) {
    return `${merchantName} レシート合計`;
  }

  return hasProductHint ? "レシート明細" : "レシート合計";
}

export function buildDiscountMemo(input: {
  originalAmount?: number | null;
  discountAmount?: number | null;
  finalAmount?: number | null;
  discountLabels?: string[] | null;
  existingNote?: string | null;
}) {
  const originalAmount = input.originalAmount ?? null;
  const discountAmount = input.discountAmount ?? null;
  const finalAmount = input.finalAmount ?? null;
  const lines: string[] = [];

  if (
    originalAmount != null &&
    discountAmount != null &&
    discountAmount < 0 &&
    finalAmount != null &&
    finalAmount > 0
  ) {
    lines.push(`${originalAmount}-${Math.abs(discountAmount)}=${finalAmount}`);
  }

  const labels = (input.discountLabels ?? []).filter(
    (label): label is string => typeof label === "string" && label.trim().length > 0
  );
  if (labels.length > 0) {
    lines.push(`備考：${labels.join("、")}`);
  }

  const existingNote = normalizeWhitespace(input.existingNote);
  if (existingNote) {
    lines.push(existingNote);
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

export function postprocessReceiptAiResult(
  result: ReceiptAiResult,
  options: {
    provider: "openai" | "ollama";
  }
): OcrExtractionLine[] {
  const normalizedRows = absorbDiscountRows(normalizeItems(result));

  const productCandidates = normalizedRows.filter((row) => {
    if (!(row.kind === "item" || row.kind === "unknown")) {
      return false;
    }

    const effectiveAmount = row.finalAmount ?? row.amount;
    if (!effectiveAmount || effectiveAmount <= 0) {
      return false;
    }

    if (!row.title || row.title.length < 2) {
      return false;
    }

    return row.itemScore >= 7;
  });

  const uniqueProducts = productCandidates.filter((row, index, list) => {
    return (
      list.findIndex(
        (candidate) =>
          candidate.title === row.title &&
          (candidate.finalAmount ?? candidate.amount) === (row.finalAmount ?? row.amount) &&
          candidate.merchantName === row.merchantName
      ) === index
    );
  });

  if (uniqueProducts.length > 0) {
    return uniqueProducts.slice(0, 30).map((row, index) => {
      const effectiveAmount = row.finalAmount ?? row.amount;
      const autoMemo = buildDiscountMemo({
        originalAmount: row.originalAmount,
        discountAmount: row.discountAmount,
        finalAmount: row.finalAmount,
        discountLabels: row.discountLabels
      });

      return {
        lineIndex: index,
        title: row.title ?? buildFallbackTitle(row.merchantName, true),
        amount: effectiveAmount,
        merchantName: row.merchantName,
        occurredOn: row.occurredOn,
        rawText: row.rawText,
        rawPayload: {
          provider: options.provider,
          extractionType: "receipt",
          kind: "item",
          rowKind: row.kind,
          itemScore: row.itemScore,
          quantity: row.quantity,
          unitPrice: row.unitPrice,
          originalAmount: row.originalAmount,
          discountAmount: row.discountAmount,
          finalAmount: row.finalAmount ?? effectiveAmount,
          categoryHint: row.categoryHint,
          confidence: row.confidence,
          discountLabels: row.discountLabels,
          absorbedDiscountRows: row.absorbedDiscountRows,
          autoMemo
        }
      };
    });
  }

  const totalCandidate =
    normalizedRows.find((row) => row.kind === "total" && row.amount && row.amount > 0) ?? null;

  if (!totalCandidate) {
    return [];
  }

  const hasProductHint = Boolean(
    normalizedRows.find((row) => (row.kind === "item" || row.kind === "unknown") && row.title)
  );

  return [
    {
      lineIndex: 0,
      title: buildFallbackTitle(totalCandidate.merchantName, hasProductHint),
      amount: totalCandidate.amount,
      merchantName: totalCandidate.merchantName,
      occurredOn: totalCandidate.occurredOn,
      rawText: totalCandidate.rawText ?? normalizeWhitespace(result.rawText) ?? null,
      rawPayload: {
        provider: options.provider,
        extractionType: "receipt",
        kind: "total",
        rowKind: totalCandidate.kind,
        categoryHint: totalCandidate.categoryHint
      }
    }
  ];
}
