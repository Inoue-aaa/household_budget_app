import type { ClassificationInput, ClassificationResult } from "@/lib/classification/types";

export interface ExpenseClassifier {
  suggest(input: ClassificationInput): Promise<ClassificationResult>;
}

export class RuleFirstDummyClassifier implements ExpenseClassifier {
  async suggest(input: ClassificationInput): Promise<ClassificationResult> {
    void input;

    return {
      suggestions: [],
      needsReview: true
    };
  }
}
