import type { OcrExtractionLine } from "@/lib/ocr/types";

export type ReceiptAiItemKind =
  | "item"
  | "subtotal"
  | "tax"
  | "total"
  | "tendered"
  | "change"
  | "unknown";

export type ReceiptAiItem = {
  title: string | null;
  amount: number | string | null;
  kind: ReceiptAiItemKind;
  rawText: string | null;
};

export type ReceiptAiResult = {
  merchantName: string | null;
  occurredOn: string | null;
  items: ReceiptAiItem[];
  rawText?: string | null;
};

type NormalizedReceiptItem = {
  index: number;
  merchantName: string | null;
  occurredOn: string | null;
  title: string | null;
  amount: number | null;
  kind: ReceiptAiItemKind;
  rawText: string | null;
  itemScore: number;
  rightEdgeAmountLike: boolean;
};

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
  "レジ",
  "担当",
  "取引",
  "店舗",
  "receipt",
  "no.",
  "領収"
];

function normalizeWhitespace(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() || null;
}

function containsKeyword(value: string | null, keywords: string[]) {
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

  return /[¥￥]?\s*\d[\d,]*\s*$/.test(value);
}

function normalizeAmount(value: number | string | null | undefined, rawText: string | null) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d]/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  if (!rawText) {
    return null;
  }

  const matches = rawText.match(/\d[\d,]*/g);
  if (!matches || matches.length === 0) {
    return null;
  }

  const lastMatch = matches[matches.length - 1]?.replace(/,/g, "");
  const parsed = Number(lastMatch);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function stripTrailingAmount(value: string) {
  return value
    .replace(/[¥￥]\s*\d[\d,]*/g, "")
    .replace(/\b\d{1,3}(?:,\d{3})+\b/g, "")
    .replace(/\b\d{2,5}\b$/, "")
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
  const explicitTitle = cleanTitle(item.title);
  if (explicitTitle) {
    return explicitTitle;
  }

  const rawText = normalizeWhitespace(item.rawText);
  if (!rawText) {
    return null;
  }

  const leftMatch = rawText.match(/^(.*?)(?:[¥￥]?\s*\d[\d,]*)\s*$/);
  if (leftMatch?.[1]) {
    const leftTitle = cleanTitle(leftMatch[1]);
    if (leftTitle) {
      return leftTitle;
    }
  }

  const rightMatch = rawText.match(/^[^¥￥\d]*[¥￥]?\s*\d[\d,]*\s+(.*)$/);
  if (rightMatch?.[1]) {
    const rightTitle = cleanTitle(rightMatch[1]);
    if (rightTitle) {
      return rightTitle;
    }
  }

  return null;
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

  if (input.title && input.title.length >= 3 && input.title.length <= 18) {
    score += 2;
  }

  if (input.title && /[ぁ-んァ-ヶ一-龠A-Za-z]/.test(input.title)) {
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

function scoreNeighborTitle(source: NormalizedReceiptItem, candidate: NormalizedReceiptItem) {
  if (candidate.amount) {
    return -Infinity;
  }

  if (!candidate.title) {
    return -Infinity;
  }

  if (!(candidate.kind === "item" || candidate.kind === "unknown")) {
    return -Infinity;
  }

  const distance = Math.abs(candidate.index - source.index);
  if (distance === 0 || distance > 2) {
    return -Infinity;
  }

  let score = 0;
  score += candidate.title.length >= 3 ? 3 : 1;
  score += /[ぁ-んァ-ヶ一-龠A-Za-z]/.test(candidate.title) ? 2 : 0;
  score += distance === 1 ? 4 : 2;

  return score;
}

function pairNeighborTitles(rows: NormalizedReceiptItem[]) {
  const usedTitleIndexes = new Set<number>();

  return rows.map((row) => {
    if (row.title || !row.amount || !(row.kind === "item" || row.kind === "unknown")) {
      return row;
    }

    const candidates = rows
      .filter((candidate) => !usedTitleIndexes.has(candidate.index))
      .map((candidate) => ({
        candidate,
        score: scoreNeighborTitle(row, candidate)
      }))
      .filter((entry) => Number.isFinite(entry.score))
      .sort((left, right) => right.score - left.score);

    const best = candidates[0]?.candidate;

    if (!best?.title) {
      return row;
    }

    usedTitleIndexes.add(best.index);

    return {
      ...row,
      title: best.title
    };
  });
}

function buildFallbackTitle(merchantName: string | null, hasProductHint: boolean) {
  if (merchantName && hasProductHint) {
    return `${merchantName} 商品候補`;
  }

  if (merchantName) {
    return `${merchantName} レシート合計`;
  }

  return hasProductHint ? "レシート明細" : "レシート合計";
}

function normalizeItems(result: ReceiptAiResult) {
  const baseRows = result.items.map((item, index) => {
    const rawText = normalizeWhitespace(item.rawText);
    const title = deriveTitleCandidate(item);
    const amount = normalizeAmount(item.amount, rawText);
    const rightEdgeAmountLike = hasRightEdgeAmount(rawText);

    return {
      index,
      merchantName: normalizeWhitespace(result.merchantName),
      occurredOn: normalizeWhitespace(result.occurredOn),
      title,
      amount,
      kind: item.kind,
      rawText,
      rightEdgeAmountLike,
      itemScore: scoreItemCandidate({
        title,
        amount,
        rawText,
        kind: item.kind,
        rightEdgeAmountLike
      })
    } satisfies NormalizedReceiptItem;
  });

  const pairedRows = pairNeighborTitles(baseRows);

  return pairedRows.map((row) => ({
    ...row,
    itemScore: scoreItemCandidate({
      title: row.title,
      amount: row.amount,
      rawText: row.rawText,
      kind: row.kind,
      rightEdgeAmountLike: row.rightEdgeAmountLike
    })
  }));
}

export function postprocessReceiptAiResult(
  result: ReceiptAiResult,
  options: {
    provider: "openai" | "ollama";
  }
): OcrExtractionLine[] {
  const normalizedRows = normalizeItems(result);

  const productCandidates = normalizedRows.filter((row) => {
    if (!(row.kind === "item" || row.kind === "unknown")) {
      return false;
    }

    if (!row.amount || row.amount <= 0) {
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
          candidate.amount === row.amount &&
          candidate.merchantName === row.merchantName
      ) === index
    );
  });

  if (uniqueProducts.length > 0) {
    return uniqueProducts.slice(0, 8).map((row, index) => ({
      lineIndex: index,
      title: row.title ?? buildFallbackTitle(row.merchantName, true),
      amount: row.amount,
      merchantName: row.merchantName,
      occurredOn: row.occurredOn,
      rawText: row.rawText,
      rawPayload: {
        provider: options.provider,
        extractionType: "receipt",
        kind: "item",
        rowKind: row.kind,
        itemScore: row.itemScore
      }
    }));
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
        rowKind: totalCandidate.kind
      }
    }
  ];
}
