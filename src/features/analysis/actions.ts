"use server";

import { z } from "zod";
import { getAnalysisSnapshot } from "@/lib/finance/queries";
import { getOpenAiApiKey } from "@/lib/utils/env";

const MAX_ANALYSIS_RANGE_DAYS = 120;
const DEFAULT_ANALYSIS_MODEL = "gpt-4.1-mini";

const TEMPLATE_QUESTIONS = {
  high_spend_categories: "この期間で支出が多いカテゴリを教えて",
  saving_points: "節約できそうなポイントを教えて",
  increased_spending: "前の期間と比べて増えた支出を教えて",
  over_budget: "予算オーバーしやすいカテゴリを教えて",
  fixed_variable_balance: "固定費と変動費のバランスを見て",
  spending_summary: "この月の支出傾向を要約して",
} as const;

const consultationSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    templateQuestion: z.string().trim().optional(),
    customQuestion: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, context) => {
    const start = new Date(`${value.startDate}T00:00:00`);
    const end = new Date(`${value.endDate}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "開始日を正しく入力してください。",
      });
      return;
    }

    if (start > end) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "終了日は開始日以降で入力してください。",
      });
    }

    const diffDays =
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > MAX_ANALYSIS_RANGE_DAYS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: `期間は${MAX_ANALYSIS_RANGE_DAYS}日以内で指定してください。`,
      });
    }

    const hasTemplate =
      value.templateQuestion != null &&
      value.templateQuestion in TEMPLATE_QUESTIONS;
    const hasCustom = (value.customQuestion ?? "").trim().length > 0;

    if (!hasTemplate && !hasCustom) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customQuestion"],
        message: "テンプレ質問を選ぶか、自由質問を入力してください。",
      });
    }
  });

export type AiConsultationTemplateKey = keyof typeof TEMPLATE_QUESTIONS;

export type DetectedInsight = {
  id: string;
  kind:
    | "budget_over"
    | "budget_near_limit"
    | "category_increase"
    | "spending_concentration"
    | "frequent_small_spend"
    | "fixed_cost_heavy";
  title: string;
  summary: string;
  relatedCategory: string | null;
  severity: "low" | "medium" | "high";
  supportingMetrics: Record<string, number | string | null>;
};

export type AiConsultationActionResult =
  | {
      status: "success";
      answer: string;
      question: string;
      periodLabel: string;
      evidenceSummary: {
        totalAmount: number;
        topCategories: { categoryName: string; totalAmount: number }[];
        differenceAmount: number;
        changeRate: number | null;
      };
      detectedInsights: DetectedInsight[];
      primaryCategoryName: string | null;
    }
  | {
      status: "error";
      message: string;
    };

type AnalysisSnapshot = Awaited<ReturnType<typeof getAnalysisSnapshot>>;

function buildTemplateQuestion(key: string | undefined) {
  if (!key) {
    return null;
  }

  return TEMPLATE_QUESTIONS[key as AiConsultationTemplateKey] ?? null;
}

function buildDetectedInsights(snapshot: AnalysisSnapshot): DetectedInsight[] {
  const insights: DetectedInsight[] = [];
  const totalAmount = snapshot.totalAmount;

  for (const item of snapshot.categoryTotals.slice(0, 5)) {
    if (item.isOverBudget && item.differenceFromBudget != null) {
      insights.push({
        id: `budget-over-${item.categoryId}`,
        kind: "budget_over",
        title: `${item.categoryName}が予算を超えています`,
        summary: `${item.categoryName}は予算を${Math.round(
          item.differenceFromBudget,
        ).toLocaleString("ja-JP")}円上回っています。`,
        relatedCategory: item.categoryName,
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
        summary: `${item.categoryName}は予算の${Math.round(item.usageRate * 100)}%を使っています。`,
        relatedCategory: item.categoryName,
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
        relatedCategory: item.categoryName,
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
      relatedCategory: topCategory.categoryName,
      severity: topCategory.shareRate >= 0.7 ? "high" : "medium",
      supportingMetrics: {
        totalAmount: topCategory.totalAmount,
        shareRate: topCategory.shareRate,
      },
    });
  }

  const smallFrequentCount = snapshot.topExpenses.filter(
    (item) => item.amount <= 500,
  ).length;
  if (smallFrequentCount >= 4) {
    insights.push({
      id: "frequent-small-spend",
      kind: "frequent_small_spend",
      title: "少額支出が重なっています",
      summary: "高額支出以外にも、小さな支出が積み上がっている可能性があります。",
      relatedCategory: null,
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
        relatedCategory: null,
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

function buildAnalysisConsultationPayload(snapshot: AnalysisSnapshot) {
  const detectedInsights = buildDetectedInsights(snapshot);

  return {
    period: snapshot.period,
    totals: {
      totalAmount: snapshot.totalAmount,
      fixedAmount: snapshot.fixedAmount,
      variableAmount: snapshot.variableAmount,
    },
    previousPeriodComparison: snapshot.previousPeriodComparison,
    budgetComparison: snapshot.budgetComparison,
    detectedInsights: detectedInsights.map((item) => ({
      kind: item.kind,
      title: item.title,
      summary: item.summary,
      relatedCategory: item.relatedCategory,
      severity: item.severity,
      supportingMetrics: item.supportingMetrics,
    })),
    categoryTotals: snapshot.categoryTotals.slice(0, 8).map((item) => ({
      categoryName: item.categoryName,
      totalAmount: item.totalAmount,
      shareRate: item.shareRate,
      differenceFromPreviousPeriod: item.differenceFromPreviousPeriod,
      budgetAmount: item.budgetAmount,
      differenceFromBudget: item.differenceFromBudget,
      usageRate: item.usageRate,
      isOverBudget: item.isOverBudget,
    })),
    trend: snapshot.trend,
    topExpenses: snapshot.topExpenses.slice(0, 5),
    topMerchants: snapshot.topMerchants.slice(0, 5),
  };
}

function extractResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const typedPayload = payload as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };

  if (typeof typedPayload.output_text === "string" && typedPayload.output_text.trim()) {
    return typedPayload.output_text.trim();
  }

  return (
    typedPayload.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join("\n")
      .trim() ?? ""
  );
}

export async function submitAiConsultationAction(
  formData: FormData,
): Promise<AiConsultationActionResult> {
  const parsed = consultationSchema.safeParse({
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    templateQuestion: formData.get("templateQuestion"),
    customQuestion: formData.get("customQuestion"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "入力内容を確認してください。",
    };
  }

  const { startDate, endDate, templateQuestion, customQuestion } = parsed.data;
  const resolvedQuestion =
    (customQuestion ?? "").trim() || buildTemplateQuestion(templateQuestion);

  if (!resolvedQuestion) {
    return {
      status: "error",
      message: "テンプレ質問を選ぶか、自由質問を入力してください。",
    };
  }

  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    return {
      status: "error",
      message: "OPENAI_API_KEY が設定されていません。",
    };
  }

  const snapshot = await getAnalysisSnapshot({ startDate, endDate });
  const detectedInsights = buildDetectedInsights(snapshot);
  const payload = buildAnalysisConsultationPayload(snapshot);
  const primaryCategoryName =
    detectedInsights.find((item) => item.relatedCategory)?.relatedCategory ??
    snapshot.categoryTotals[0]?.categoryName ??
    null;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_ANALYSIS_MODEL,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "あなたは家計簿アプリの相談アシスタントです。指定期間の集計済みデータだけを根拠に、日本語で簡潔に回答してください。不明な点は断定しすぎず、支出傾向や見直しポイントを落ち着いた口調で伝えてください。ルールベースの検出結果がある場合は、その内容を優先的に根拠として使ってください。節約提案は押しつけすぎず、根拠となる数値やカテゴリ名を短く添えてください。",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `分析データ:\n${JSON.stringify(payload, null, 2)}\n\n質問:\n${resolvedQuestion}\n\n回答は、まず要点を簡潔にまとめ、その後に根拠となる数値やカテゴリを2〜4点ほど添えてください。必要なら予算見直しの方向性も短く触れてください。`,
              },
            ],
          },
        ],
        max_output_tokens: 900,
      }),
    });

    if (!response.ok) {
      return {
        status: "error",
        message: "AIへの送信に失敗しました。時間をおいて、もう一度お試しください。",
      };
    }

    const responseJson = (await response.json()) as unknown;
    const answer = extractResponseText(responseJson);

    if (!answer) {
      return {
        status: "error",
        message: "AIから回答を受け取れませんでした。",
      };
    }

    return {
      status: "success",
      answer,
      question: resolvedQuestion,
      periodLabel: snapshot.period.label,
      evidenceSummary: {
        totalAmount: snapshot.totalAmount,
        topCategories: snapshot.categoryTotals.slice(0, 3).map((item) => ({
          categoryName: item.categoryName,
          totalAmount: item.totalAmount,
        })),
        differenceAmount: snapshot.previousPeriodComparison.differenceAmount,
        changeRate: snapshot.previousPeriodComparison.changeRate,
      },
      detectedInsights,
      primaryCategoryName,
    };
  } catch {
    return {
      status: "error",
      message: "AI送信の処理中にエラーが発生しました。",
    };
  }
}
