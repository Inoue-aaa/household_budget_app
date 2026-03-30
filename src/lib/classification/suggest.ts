import { RuleFirstDummyClassifier } from "@/lib/classification/provider";
import type { CategoryOption } from "@/lib/finance/types";

const categoryKeywords: Record<string, string[]> = {
  food: [
    "弁当",
    "おにぎり",
    "お茶",
    "飲料",
    "ジュース",
    "コーヒー",
    "珈琲",
    "パン",
    "食パン",
    "菓子",
    "スナック",
    "チョコ",
    "牛乳",
    "たまご",
    "卵",
    "野菜",
    "肉",
    "魚",
    "豆腐",
    "ヨーグルト",
    "総菜",
    "惣菜",
    "うどん",
    "そば",
    "ラーメン"
  ],
  "daily-necessities": [
    "マスク",
    "ティッシュ",
    "洗剤",
    "トイレットペーパー",
    "トイレツトペーパー",
    "石鹸",
    "せっけん",
    "電池",
    "文具",
    "ノート",
    "ペン",
    "ラップ",
    "ごみ袋",
    "ゴミ袋",
    "キッチンペーパー",
    "スポンジ",
    "除菌",
    "ウェットティッシュ"
  ],
  health: ["薬", "風邪薬", "鎮痛剤", "胃薬", "湿布", "目薬", "鼻炎", "整腸", "ビタミン"],
  "fashion-beauty": [
    "シャンプー",
    "トリートメント",
    "化粧品",
    "スキンケア",
    "ヘアケア",
    "洗顔",
    "インナー",
    "シャツ",
    "靴下",
    "ソックス",
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
  "トイレットペーパー",
  "ごみ袋",
  "ゴミ袋"
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

  // Avoid pushing obvious non-food items into food.
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
