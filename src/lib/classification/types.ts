export type CategorySuggestion = {
  categorySlug: string;
  confidence: number;
  reason: string;
  basedOnHistory: boolean;
};

export type ClassificationInput = {
  merchantName?: string | null;
  title: string;
};

export type ClassificationResult = {
  suggestions: CategorySuggestion[];
  needsReview: boolean;
};
