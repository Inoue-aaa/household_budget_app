export const AI_CONSULTATION_TEMPLATE_OPTIONS = [
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
] as const;

export type AiConsultationTemplateKey =
  (typeof AI_CONSULTATION_TEMPLATE_OPTIONS)[number]["value"];

export type AiConsultationTemplateGroup =
  (typeof AI_CONSULTATION_TEMPLATE_OPTIONS)[number]["group"];

export const TEMPLATE_QUESTIONS: Record<AiConsultationTemplateKey, string> = {
  high_spend_categories: "この期間で支出が多いカテゴリを教えて",
  saving_points: "節約できそうなポイントを教えて",
  increased_spending: "前の期間と比べて増えた支出を教えて",
  over_budget: "予算オーバーしやすいカテゴリを教えて",
  fixed_variable_balance: "固定費と変動費のバランスを見て",
  spending_summary: "この月の支出傾向を要約して",
};
