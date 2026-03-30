import { RuleFirstDummyClassifier } from "@/lib/classification/provider";
import type { CategoryOption } from "@/lib/finance/types";

const categoryKeywords: Record<string, string[]> = {
  food: [
    "おにぎり",
    "弁当",
    "パン",
    "菓子",
    "飲料",
    "ジュース",
    "コーヒー",
    "野菜",
    "肉",
    "魚",
    "牛乳",
    "たまご",
    "豆腐",
    "惣菜",
    "ラーメン",
    "うどん",
    "パスタ",
    "スナック",
    "チョコ",
    "アイス",
    "キャンディ",
    "ヨーグルト",
    "サンド"
  ],
  "daily-necessities": [
    "マスク",
    "ティッシュ",
    "洗剤",
    "トイレットペーパー",
    "石鹸",
    "電池",
    "文具",
    "ラップ",
    "ゴミ袋",
    "キッチンペーパー",
    "スポンジ",
    "歯ブラシ",
    "歯磨き粉",
    "除菌",
    "ペン",
    "ノート"
  ],
  health: ["薬", "風邪薬", "鎮痛剤", "胃薬", "湿布", "目薬", "ビタミン", "整腸剤"],
  "fashion-beauty": [
    "シャンプー",
    "化粧品",
    "スキンケア",
    "ヘアケア",
    "インナー",
    "シャツ",
    "靴下",
    "美容",
    "コスメ",
    "下着"
  ],
  other: []
};

const strongNonFoodKeywords = [
  "マスク",
  "ティッシュ",
  "洗剤",
  "電池",
  "文具",
  "ラップ",
  "ゴミ袋",
  "石鹸",
  "スポンジ",
  "歯ブラシ",
  "歯磨き粉"
];

const classifier = new RuleFirstDummyClassifier();

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function detectCategorySlugByKeywords(title: string, categories: CategoryOption[]) {
  const normalizedTitle = normalizeText(title);

  for (const category of categories) {
    const keywords = categoryKeywords[category.slug] ?? [];
    if (keywords.some((keyword) => normalizedTitle.includes(keyword.toLowerCase()))) {
      return category.slug;
    }
  }

  return null;
}

function findCategoryIdBySlug(categories: CategoryOption[], slug: string | null) {
  if (!slug) {
    return null;
  }

  return categories.find((category) => category.slug === slug)?.id ?? null;
}

export async function suggestCategoryIdForDraft(
  input: {
    title: string;
    merchantName?: string | null;
  },
  categories: CategoryOption[]
) {
  const normalizedTitle = normalizeText(input.title);
  const keywordCategorySlug = detectCategorySlugByKeywords(input.title, categories);

  if (keywordCategorySlug) {
    return {
      categoryId: findCategoryIdBySlug(categories, keywordCategorySlug),
      needsReview: false
    };
  }

  const result = await classifier.suggest({
    merchantName: input.merchantName,
    title: input.title
  });

  const firstSuggestion = result.suggestions[0];
  let suggestedSlug = firstSuggestion?.categorySlug ?? null;

  if (
    suggestedSlug === "food" &&
    strongNonFoodKeywords.some((keyword) => normalizedTitle.includes(keyword.toLowerCase()))
  ) {
    suggestedSlug = categories.some((category) => category.slug === "daily-necessities")
      ? "daily-necessities"
      : "other";
  }

  const suggestedCategory = categories.find((category) => category.slug === suggestedSlug);

  return {
    categoryId: suggestedCategory?.id ?? null,
    needsReview: !suggestedCategory || result.needsReview
  };
}
