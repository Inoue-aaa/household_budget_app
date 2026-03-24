import { RuleFirstDummyClassifier } from "@/lib/classification/provider";
import type { CategoryOption } from "@/lib/finance/types";

const categoryKeywords: Record<string, string[]> = {
  food: ["卵", "牛乳", "パン", "野菜", "肉", "魚", "米"],
  "daily-necessities": ["洗剤", "ティッシュ", "トイレット", "日用品"],
  luxury: ["ビール", "酒", "お菓子", "コーヒー"]
};

const classifier = new RuleFirstDummyClassifier();

export async function suggestCategoryIdForDraft(
  input: {
    title: string;
    merchantName?: string | null;
  },
  categories: CategoryOption[]
) {
  const lowerTitle = input.title.trim().toLowerCase();

  for (const category of categories) {
    const keywords = categoryKeywords[category.slug] ?? [];
    if (keywords.some((keyword) => lowerTitle.includes(keyword.toLowerCase()))) {
      return {
        categoryId: category.id,
        needsReview: false
      };
    }
  }

  const result = await classifier.suggest({
    merchantName: input.merchantName,
    title: input.title
  });

  const firstSuggestion = result.suggestions[0];
  const suggestedCategory = categories.find((category) => category.slug === firstSuggestion?.categorySlug);

  return {
    categoryId: suggestedCategory?.id ?? null,
    needsReview: !suggestedCategory || result.needsReview
  };
}
