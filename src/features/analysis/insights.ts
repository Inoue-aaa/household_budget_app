import type {
  AnalysisSnapshot,
  ConsultationInsight,
  ConsultationTemplateKey,
} from "@/lib/finance/types";

export type ConsultationTemplateOption = {
  value: ConsultationTemplateKey;
  label: string;
  group: "monthly" | "comparison" | "budget";
};

type SuggestedQuestionGroup = ConsultationTemplateOption["group"];

export const CONSULTATION_TEMPLATE_QUESTION_MAP: Record<
  ConsultationTemplateKey,
  string
> = {
  high_spend_categories: "この期間で支出が多いカテゴリを教えて",
  saving_points: "今月の支出で見直しやすい項目を教えて",
  increased_spending: "前の期間と比べて増えた支出を教えて",
  over_budget: "予算オーバーしやすいカテゴリを教えて",
  fixed_variable_balance: "固定費と変動費のバランスを見て",
  spending_summary: "この月の支出傾向を要約して",
};

export const CONSULTATION_TEMPLATE_OPTIONS: ConsultationTemplateOption[] = [
  {
    value: "saving_points",
    label: "今月の支出で見直しやすい項目を教えて",
    group: "monthly",
  },
  {
    value: "high_spend_categories",
    label: "この期間で支出が多いカテゴリを教えて",
    group: "monthly",
  },
  {
    value: "increased_spending",
    label: "前の期間と比べて増えた支出を教えて",
    group: "comparison",
  },
  {
    value: "over_budget",
    label: "予算オーバーしやすいカテゴリを教えて",
    group: "budget",
  },
  {
    value: "fixed_variable_balance",
    label: "固定費と変動費のバランスを見て",
    group: "budget",
  },
  {
    value: "spending_summary",
    label: "この月の支出傾向を要約して",
    group: "monthly",
  },
];

export function resolveTemplateQuestion(key?: string | null) {
  if (!key) {
    return null;
  }

  return CONSULTATION_TEMPLATE_QUESTION_MAP[key as ConsultationTemplateKey] ?? null;
}

export function buildDetectedInsights(snapshot: AnalysisSnapshot): ConsultationInsight[] {
  const insights: ConsultationInsight[] = [];
  const totalAmount = snapshot.totalAmount;

  for (const item of snapshot.categoryTotals.slice(0, 5)) {
    if (item.isOverBudget && item.differenceFromBudget != null) {
      insights.push({
        id: `budget-over-${item.categoryId}`,
        kind: "budget_over",
        title: `${item.categoryName}が予算を超えています`,
        summary: `${item.categoryName}は予算より${Math.round(
          item.differenceFromBudget,
        ).toLocaleString("ja-JP")}円多く使われています。`,
        relatedCategoryId: item.categoryId,
        relatedCategoryName: item.categoryName,
        severity: "high",
        supportingMetrics: {
          budgetAmount: item.budgetAmount,
          spentAmount: item.totalAmount,
          differenceFromBudget: item.differenceFromBudget,
        },
      });
    } else if (
      item.usageRate != null &&
      item.usageRate >= 0.8 &&
      item.budgetAmount != null &&
      item.budgetAmount > 0
    ) {
      insights.push({
        id: `budget-near-${item.categoryId}`,
        kind: "budget_near_limit",
        title: `${item.categoryName}が予算に近づいています`,
        summary: `${item.categoryName}は予算の${Math.round(
          item.usageRate * 100,
        )}%を使っています。`,
        relatedCategoryId: item.categoryId,
        relatedCategoryName: item.categoryName,
        severity: item.usageRate >= 0.95 ? "high" : "medium",
        supportingMetrics: {
          budgetAmount: item.budgetAmount,
          spentAmount: item.totalAmount,
          usageRate: item.usageRate,
        },
      });
    }

    if (
      item.differenceFromPreviousPeriod != null &&
      item.differenceFromPreviousPeriod >= 1000
    ) {
      insights.push({
        id: `increase-${item.categoryId}`,
        kind: "category_increase",
        title: `${item.categoryName}が前期間より増えています`,
        summary: `${item.categoryName}は前期間より${Math.round(
          item.differenceFromPreviousPeriod,
        ).toLocaleString("ja-JP")}円増えています。`,
        relatedCategoryId: item.categoryId,
        relatedCategoryName: item.categoryName,
        severity: item.differenceFromPreviousPeriod >= 5000 ? "high" : "medium",
        supportingMetrics: {
          totalAmount: item.totalAmount,
          differenceFromPreviousPeriod: item.differenceFromPreviousPeriod,
        },
      });
    }
  }

  const topCategory = snapshot.categoryTotals[0];
  if (topCategory && topCategory.shareRate >= 0.5 && totalAmount > 0) {
    insights.push({
      id: `concentration-${topCategory.categoryId}`,
      kind: "spending_concentration",
      title: `${topCategory.categoryName}への支出が集中しています`,
      summary: `${topCategory.categoryName}が全体の${Math.round(
        topCategory.shareRate * 100,
      )}%を占めています。`,
      relatedCategoryId: topCategory.categoryId,
      relatedCategoryName: topCategory.categoryName,
      severity: topCategory.shareRate >= 0.7 ? "high" : "medium",
      supportingMetrics: {
        totalAmount: topCategory.totalAmount,
        shareRate: topCategory.shareRate,
      },
    });
  }

  const smallFrequentCount = snapshot.topExpenses.filter((item) => item.amount <= 500).length;
  if (smallFrequentCount >= 4) {
    insights.push({
      id: "frequent-small-spend",
      kind: "frequent_small_spend",
      title: "少額支出が重なっています",
      summary:
        "少額の支出が複数回重なっているため、見直せる項目がないか確認しやすい状態です。",
      relatedCategoryId: null,
      relatedCategoryName: null,
      severity: "low",
      supportingMetrics: {
        smallExpenseCount: smallFrequentCount,
      },
    });
  }

  if (totalAmount > 0) {
    const fixedRate = snapshot.fixedAmount / totalAmount;
    if (fixedRate >= 0.6) {
      insights.push({
        id: "fixed-cost-heavy",
        kind: "fixed_cost_heavy",
        title: "固定費の比率が高めです",
        summary: `固定費が全体の${Math.round(fixedRate * 100)}%を占めています。`,
        relatedCategoryId: null,
        relatedCategoryName: null,
        severity: fixedRate >= 0.75 ? "high" : "medium",
        supportingMetrics: {
          fixedAmount: snapshot.fixedAmount,
          variableAmount: snapshot.variableAmount,
          fixedRate,
        },
      });
    }
  }

  return insights.slice(0, 5);
}

export function resolveSuggestedGroups(
  startDate: string,
  endDate: string,
): { heading: string; groups: SuggestedQuestionGroup[] } {
  const today = new Date();
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diffDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const sameMonth =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth();
  const isCurrentMonth =
    sameMonth &&
    start.getFullYear() === today.getFullYear() &&
    start.getMonth() === today.getMonth();

  if (isCurrentMonth) {
    return {
      heading: "今月におすすめ",
      groups: ["monthly", "budget"],
    };
  }

  if (sameMonth && diffDays >= 28) {
    return {
      heading: "振り返りにおすすめ",
      groups: ["comparison", "monthly"],
    };
  }

  return {
    heading: "おすすめ質問",
    groups: ["monthly", "comparison"],
  };
}
