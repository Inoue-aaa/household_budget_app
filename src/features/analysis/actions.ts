"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getAuthenticatedAccountContext } from "@/lib/accounts/queries";
import type {
  ConsultationEvidenceSummary,
  ConsultationMessageItem,
  ConsultationSessionDetail,
  ConsultationSessionItem,
} from "@/lib/finance/types";
import { getAnalysisSnapshot, listCategories } from "@/lib/finance/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOpenAiApiKey } from "@/lib/utils/env";
import { formatDisplayDate } from "@/lib/utils/format";
import {
  buildDetectedInsights,
  CONSULTATION_TEMPLATE_QUESTION_MAP,
  resolveTemplateQuestion,
} from "@/features/analysis/insights";
import type {
  ConsultationMessageRow,
  ConsultationSessionRow,
} from "@/lib/finance/db-types";

const MAX_ANALYSIS_RANGE_DAYS = 120;
const DEFAULT_ANALYSIS_MODEL = "gpt-4.1-mini";
const MAX_CONTEXT_MESSAGES = 4;

const consultationSchema = z
  .object({
    sessionId: z.string().uuid().optional().or(z.literal("")),
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
        message: "開始日と終了日の形式を確認してください。"
      });
      return;
    }

    if (start > end) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "終了日は開始日以降で入力してください。"
      });
    }

    const diffDays =
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > MAX_ANALYSIS_RANGE_DAYS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: `期間は${MAX_ANALYSIS_RANGE_DAYS}日以内で指定してください。`
      });
    }

    const hasTemplate =
      value.templateQuestion != null &&
      value.templateQuestion in CONSULTATION_TEMPLATE_QUESTION_MAP;
    const hasCustom = (value.customQuestion ?? "").trim().length > 0;

    if (!hasTemplate && !hasCustom) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customQuestion"],
        message:
          "テンプレ質問を選ぶか、自由質問を入力してください。"
      });
    }
  });

const toggleSavedCardSchema = z.object({
  sessionId: z.string().uuid(),
  messageId: z.string().uuid(),
  shouldSave: z.enum(["true", "false"]),
});

export type AiConsultationTemplateKey = keyof typeof CONSULTATION_TEMPLATE_QUESTION_MAP;
export type DetectedInsight = ReturnType<typeof buildDetectedInsights>[number];

export type AiConsultationActionResult =
  | {
      status: "success";
      session: ConsultationSessionDetail;
      answer: string;
      question: string;
      periodLabel: string;
      evidenceSummary: ConsultationEvidenceSummary;
      detectedInsights: DetectedInsight[];
      primaryCategoryId: string | null;
      primaryCategoryName: string | null;
      latestAssistantMessageId: string;
      isSaved: boolean;
    }
  | {
      status: "error";
      message: string;
    };

export type ToggleSavedConsultationCardResult =
  | {
      status: "success";
      messageId: string;
      isSaved: boolean;
    }
  | {
      status: "error";
      message: string;
    };

function createSessionTitle(question: string) {
  return question.length > 36 ? `${question.slice(0, 36)}窶ｦ` : question;
}

function createAnswerSummary(answer: string) {
  const normalized = answer.replace(/\s+/g, " ").trim();
  return normalized.length > 120 ? `${normalized.slice(0, 120)}窶ｦ` : normalized;
}

function buildEvidenceSummary(
  snapshot: Awaited<ReturnType<typeof getAnalysisSnapshot>>,
): ConsultationEvidenceSummary {
  return {
    totalAmount: snapshot.totalAmount,
    topCategories: snapshot.categoryTotals.slice(0, 3).map((item) => ({
      categoryName: item.categoryName,
      totalAmount: item.totalAmount,
    })),
    differenceAmount: snapshot.previousPeriodComparison.differenceAmount,
    changeRate: snapshot.previousPeriodComparison.changeRate,
  };
}

function buildAnalysisConsultationPayload(
  snapshot: Awaited<ReturnType<typeof getAnalysisSnapshot>>,
) {
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
      relatedCategoryId: item.relatedCategoryId,
      relatedCategoryName: item.relatedCategoryName,
      severity: item.severity,
      supportingMetrics: item.supportingMetrics,
    })),
    categoryTotals: snapshot.categoryTotals.slice(0, 8).map((item) => ({
      categoryId: item.categoryId,
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

  if (
    typeof typedPayload.output_text === "string" &&
    typedPayload.output_text.trim()
  ) {
    return typedPayload.output_text.trim();
  }

  return (
    typedPayload.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
      .join("\n")
      .trim() ?? ""
  );
}

function normalizeSessionItem(row: ConsultationSessionRow): ConsultationSessionItem {
  return {
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
    periodLabel: `${formatDisplayDate(row.start_date)} ${formatDisplayDate(
      row.end_date,
    )}`,
    title: row.title ?? row.last_question ?? "AI相談",
    lastQuestion: row.last_question,
    lastAnswerSummary: row.last_answer_summary,
    latestTemplateKey: row.latest_template_key as AiConsultationTemplateKey | null,
    lastConsultedAt: row.last_consulted_at,
  };
}

function buildMessageItem(
  row: ConsultationMessageRow,
  categoryMap: Map<string, string>,
  isSaved: boolean,
): ConsultationMessageItem {
  const metadata = row.metadata ?? {};
  const evidenceSummary =
    metadata &&
    typeof metadata === "object" &&
    "evidenceSummary" in metadata &&
    metadata.evidenceSummary &&
    typeof metadata.evidenceSummary === "object"
      ? (metadata.evidenceSummary as ConsultationEvidenceSummary)
      : null;

  const detectedInsights =
    metadata &&
    typeof metadata === "object" &&
    "detectedInsights" in metadata &&
    Array.isArray(metadata.detectedInsights)
      ? (metadata.detectedInsights as DetectedInsight[])
      : [];

  const primaryCategoryId =
    metadata &&
    typeof metadata === "object" &&
    typeof metadata.primaryCategoryId === "string"
      ? metadata.primaryCategoryId
      : null;

  const primaryCategoryName =
    metadata &&
    typeof metadata === "object" &&
    typeof metadata.primaryCategoryName === "string"
      ? metadata.primaryCategoryName
      : primaryCategoryId
        ? (categoryMap.get(primaryCategoryId) ?? null)
        : null;

  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
    templateKey: row.template_key as AiConsultationTemplateKey | null,
    answerSummary: row.answer_summary,
    evidenceSummary,
    detectedInsights,
    primaryCategoryId,
    primaryCategoryName,
    isSaved,
  };
}

function buildConversationContext(messages: ConsultationMessageRow[]) {
  if (messages.length === 0) {
    return {
      recentMessages: [] as ConsultationMessageRow[],
      earlierSummary: null as string | null,
    };
  }

  const recentMessages = messages.slice(-MAX_CONTEXT_MESSAGES);
  const earlierMessages = messages.slice(0, -MAX_CONTEXT_MESSAGES);
  const earlierSummaryParts = earlierMessages
    .filter((item) => item.role === "assistant" && item.answer_summary)
    .map((item) => item.answer_summary as string);

  return {
    recentMessages,
    earlierSummary:
      earlierSummaryParts.length > 0 ? earlierSummaryParts.join(" / ") : null,
  };
}

function buildConversationPrompt(messages: ConsultationMessageRow[]) {
  const { recentMessages, earlierSummary } = buildConversationContext(messages);

  return {
    earlierSummary,
    recentMessages: recentMessages.map((item) => ({
      role: item.role,
      content: item.content,
    })),
  };
}

async function buildSessionDetail(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  sessionRow: ConsultationSessionRow,
) {
  const [categories, { data: messageRows }, { data: savedRows }] = await Promise.all([
    listCategories(),
    supabase
      .from("consultation_messages")
      .select(
        "id, session_id, user_id, account_id, role, content, template_key, answer_summary, metadata, created_at",
      )
      .eq("session_id", sessionRow.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("saved_consultation_cards")
      .select("message_id")
      .eq("session_id", sessionRow.id),
  ]);

  const categoryMap = new Map(categories.map((item) => [item.id, item.name]));
  const savedMessageIds = new Set(
    (savedRows ?? [])
      .map((row) => row.message_id)
      .filter((value): value is string => typeof value === "string"),
  );

  return {
    ...normalizeSessionItem(sessionRow),
    messages: ((messageRows ?? []) as ConsultationMessageRow[]).map((row) =>
      buildMessageItem(row, categoryMap, savedMessageIds.has(row.id)),
    ),
  } satisfies ConsultationSessionDetail;
}

function buildEphemeralSessionDetail(params: {
  startDate: string;
  endDate: string;
  periodLabel: string;
  question: string;
  answer: string;
  templateKey: AiConsultationTemplateKey | null;
  evidenceSummary: ConsultationEvidenceSummary;
  detectedInsights: DetectedInsight[];
  primaryCategoryId: string | null;
  primaryCategoryName: string | null;
  existingMessages?: ConsultationMessageItem[];
}) {
  const createdAt = new Date().toISOString();
  const userMessage: ConsultationMessageItem = {
    id: randomUUID(),
    role: "user",
    content: params.question,
    createdAt,
    templateKey: params.templateKey,
    answerSummary: null,
    evidenceSummary: null,
    detectedInsights: [],
    primaryCategoryId: null,
    primaryCategoryName: null,
    isSaved: false,
  };
  const assistantMessage: ConsultationMessageItem = {
    id: randomUUID(),
    role: "assistant",
    content: params.answer,
    createdAt,
    templateKey: params.templateKey,
    answerSummary: createAnswerSummary(params.answer),
    evidenceSummary: params.evidenceSummary,
    detectedInsights: params.detectedInsights,
    primaryCategoryId: params.primaryCategoryId,
    primaryCategoryName: params.primaryCategoryName,
    isSaved: false,
  };

  return {
    id: randomUUID(),
    startDate: params.startDate,
    endDate: params.endDate,
    periodLabel: params.periodLabel,
    title: createSessionTitle(params.question),
    lastQuestion: params.question,
    lastAnswerSummary: createAnswerSummary(params.answer),
    latestTemplateKey: params.templateKey,
    lastConsultedAt: createdAt,
    messages: [...(params.existingMessages ?? []), userMessage, assistantMessage],
  } satisfies ConsultationSessionDetail;
}

export async function submitAiConsultationAction(
  formData: FormData,
): Promise<AiConsultationActionResult> {
  const parsed = consultationSchema.safeParse({
    sessionId: formData.get("sessionId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    templateQuestion: formData.get("templateQuestion"),
    customQuestion: formData.get("customQuestion"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ??
        "入力内容を確認してから、もう一度お試しください。"
    };
  }

  const { startDate, endDate, templateQuestion, customQuestion } = parsed.data;
  const sessionId =
    parsed.data.sessionId && parsed.data.sessionId.length > 0
      ? parsed.data.sessionId
      : null;

  const resolvedQuestion =
    (customQuestion ?? "").trim() || resolveTemplateQuestion(templateQuestion);

  if (!resolvedQuestion) {
    return {
      status: "error",
      message:
        "テンプレ質問を選ぶか、自由質問を入力してください。"
    };
  }

  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    return {
      status: "error",
      message: "OPENAI_API_KEY が設定されていません。"
    };
  }

  const accountContext = await getAuthenticatedAccountContext();
  if (!accountContext) {
    return {
      status: "error",
      message: "ログイン状態を確認してから、もう一度お試しください。"
    };
  }

  const [supabase, snapshot, categories] = await Promise.all([
    createServerSupabaseClient(),
    getAnalysisSnapshot({ startDate, endDate }),
    listCategories(),
  ]);
  const categoryMap = new Map(categories.map((item) => [item.id, item.name]));

  let currentSessionRow: ConsultationSessionRow | null = null;
  let existingMessages: ConsultationMessageRow[] = [];

  if (sessionId) {
    const [{ data: sessionRow }, { data: messageRows }] = await Promise.all([
      supabase
        .from("consultation_sessions")
        .select(
          "id, user_id, account_id, start_date, end_date, latest_template_key, title, last_question, last_answer_summary, last_consulted_at, created_at, updated_at",
        )
        .eq("id", sessionId)
        .eq("account_id", accountContext.currentAccount.id)
        .maybeSingle(),
      supabase
        .from("consultation_messages")
        .select(
          "id, session_id, user_id, account_id, role, content, template_key, answer_summary, metadata, created_at",
        )
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true }),
    ]);

    if (
      sessionRow &&
      sessionRow.start_date === startDate &&
      sessionRow.end_date === endDate
    ) {
      currentSessionRow = sessionRow as ConsultationSessionRow;
      existingMessages = (messageRows ?? []) as ConsultationMessageRow[];
    }
  }

  const detectedInsights = buildDetectedInsights(snapshot);
  const payload = buildAnalysisConsultationPayload(snapshot);
  const evidenceSummary = buildEvidenceSummary(snapshot);
  const primaryCategory =
    detectedInsights.find((item) => item.relatedCategoryId)?.relatedCategoryId
      ? detectedInsights.find((item) => item.relatedCategoryId)
      : snapshot.categoryTotals[0]
        ? {
            relatedCategoryId: snapshot.categoryTotals[0].categoryId,
            relatedCategoryName: snapshot.categoryTotals[0].categoryName,
          }
        : null;
  const conversationContext = buildConversationPrompt(existingMessages);
  const buildFallbackSuccess = (answerText: string): AiConsultationActionResult => {
    const fallbackSession = buildEphemeralSessionDetail({
      startDate,
      endDate,
      periodLabel: snapshot.period.label,
      question: resolvedQuestion,
      answer: answerText,
      templateKey: (templateQuestion as AiConsultationTemplateKey | null) ?? null,
      evidenceSummary,
      detectedInsights,
      primaryCategoryId: primaryCategory?.relatedCategoryId ?? null,
      primaryCategoryName: primaryCategory?.relatedCategoryName ?? null,
      existingMessages: existingMessages.map((row) =>
        buildMessageItem(row, categoryMap, false),
      ),
    });

    return {
      status: "success",
      session: fallbackSession,
      answer: answerText,
      question: resolvedQuestion,
      periodLabel: snapshot.period.label,
      evidenceSummary,
      detectedInsights,
      primaryCategoryId: primaryCategory?.relatedCategoryId ?? null,
      primaryCategoryName: primaryCategory?.relatedCategoryName ?? null,
      latestAssistantMessageId:
        fallbackSession.messages[fallbackSession.messages.length - 1]?.id ?? randomUUID(),
      isSaved: false,
    };
  };

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
                  "あなたは家計簿アプリの相談アシスタントです。渡された集計データだけを根拠に、日本語で簡潔かつ自然に回答してください。不明な点は断定せず、見直しポイントは押しつけすぎない表現で伝えてください。"
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify(
                  {
                    question: resolvedQuestion,
                    analysisData: payload,
                    conversationContext,
                  },
                  null,
                  2,
                ),
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
        message:
          "AIへの接続に失敗しました。時間をおいて、もう一度お試しください。"
      };
    }

    const responseJson = (await response.json()) as unknown;
    const answer = extractResponseText(responseJson);

    if (!answer) {
      return {
        status: "error",
        message: "AIから回答を受け取れませんでした。"
      };
    }

    const sessionPayload = {
      user_id: accountContext.userId,
      account_id: accountContext.currentAccount.id,
      start_date: startDate,
      end_date: endDate,
      latest_template_key: templateQuestion || null,
      title: createSessionTitle(resolvedQuestion),
      last_question: resolvedQuestion,
      last_answer_summary: createAnswerSummary(answer),
      last_consulted_at: new Date().toISOString(),
    };

    if (!currentSessionRow) {
      const { data: insertedSession, error: sessionInsertError } = await supabase
        .from("consultation_sessions")
        .insert(sessionPayload)
        .select(
          "id, user_id, account_id, start_date, end_date, latest_template_key, title, last_question, last_answer_summary, last_consulted_at, created_at, updated_at",
        )
        .single();

      if (sessionInsertError || !insertedSession) {
        return buildFallbackSuccess(answer);
      }

      currentSessionRow = insertedSession as ConsultationSessionRow;
    } else {
      const { data: updatedSession, error: sessionUpdateError } = await supabase
        .from("consultation_sessions")
        .update(sessionPayload)
        .eq("id", currentSessionRow.id)
        .eq("account_id", accountContext.currentAccount.id)
        .select(
          "id, user_id, account_id, start_date, end_date, latest_template_key, title, last_question, last_answer_summary, last_consulted_at, created_at, updated_at",
        )
        .single();

      if (sessionUpdateError || !updatedSession) {
        return buildFallbackSuccess(answer);
      }

      currentSessionRow = updatedSession as ConsultationSessionRow;
    }

    const { data: insertedUserMessage, error: userMessageError } = await supabase
      .from("consultation_messages")
      .insert({
        session_id: currentSessionRow.id,
        user_id: accountContext.userId,
        account_id: accountContext.currentAccount.id,
        role: "user",
        content: resolvedQuestion,
        template_key: templateQuestion || null,
        answer_summary: null,
        metadata: {
          periodLabel: snapshot.period.label,
        },
      })
      .select(
        "id, session_id, user_id, account_id, role, content, template_key, answer_summary, metadata, created_at",
      )
      .single();

    if (userMessageError || !insertedUserMessage) {
        return buildFallbackSuccess(answer);
      }

    const assistantMetadata = {
      periodLabel: snapshot.period.label,
      evidenceSummary,
      detectedInsights,
      primaryCategoryId: primaryCategory?.relatedCategoryId ?? null,
      primaryCategoryName: primaryCategory?.relatedCategoryName ?? null,
    };

    const { data: insertedAssistantMessage, error: assistantMessageError } =
      await supabase
        .from("consultation_messages")
        .insert({
          session_id: currentSessionRow.id,
          user_id: accountContext.userId,
          account_id: accountContext.currentAccount.id,
          role: "assistant",
          content: answer,
          template_key: templateQuestion || null,
          answer_summary: createAnswerSummary(answer),
          metadata: assistantMetadata,
        })
        .select(
          "id, session_id, user_id, account_id, role, content, template_key, answer_summary, metadata, created_at",
        )
        .single();

    if (assistantMessageError || !insertedAssistantMessage) {
        return buildFallbackSuccess(answer);
      }

    const fullSession = await buildSessionDetail(supabase, currentSessionRow);

    return {
      status: "success",
      session: fullSession,
      answer,
      question: resolvedQuestion,
      periodLabel: snapshot.period.label,
      evidenceSummary,
      detectedInsights,
      primaryCategoryId: primaryCategory?.relatedCategoryId ?? null,
      primaryCategoryName: primaryCategory?.relatedCategoryName ?? null,
      latestAssistantMessageId: insertedAssistantMessage.id,
      isSaved: false,
    };
  } catch {
    return {
      status: "error",
      message: "AI相談の処理中にエラーが発生しました。"
    };
  }
}

export async function toggleSavedConsultationCardAction(
  formData: FormData,
): Promise<ToggleSavedConsultationCardResult> {
  const parsed = toggleSavedCardSchema.safeParse({
    sessionId: formData.get("sessionId"),
    messageId: formData.get("messageId"),
    shouldSave: formData.get("shouldSave"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "保存設定を更新できませんでした。"
    };
  }

  const accountContext = await getAuthenticatedAccountContext();
  if (!accountContext) {
    return {
      status: "error",
      message: "ログイン状態を確認してから、もう一度お試しください。"
    };
  }

  const supabase = await createServerSupabaseClient();

  if (parsed.data.shouldSave === "true") {
    const { data: messageRow, error: messageError } = await supabase
      .from("consultation_messages")
      .select(
        "id, session_id, user_id, account_id, role, content, template_key, answer_summary, metadata, created_at",
      )
      .eq("id", parsed.data.messageId)
      .eq("session_id", parsed.data.sessionId)
      .eq("account_id", accountContext.currentAccount.id)
      .eq("role", "assistant")
      .maybeSingle();

    if (messageError || !messageRow) {
      return {
        status: "error",
        message: "保存対象の回答が見つかりませんでした。"
      };
    }

    const metadata = messageRow.metadata ?? {};
    const relatedCategoryId =
      metadata &&
      typeof metadata === "object" &&
      typeof metadata.primaryCategoryId === "string"
        ? metadata.primaryCategoryId
        : null;

    const { error } = await supabase.from("saved_consultation_cards").upsert(
      {
        session_id: parsed.data.sessionId,
        message_id: parsed.data.messageId,
        user_id: accountContext.userId,
        account_id: accountContext.currentAccount.id,
        title: createSessionTitle(messageRow.content),
        answer_summary:
          messageRow.answer_summary ?? createAnswerSummary(messageRow.content),
        related_category_id: relatedCategoryId,
      },
      { onConflict: "message_id" },
    );

    if (error) {
      return {
        status: "error",
        message: "回答を保存できませんでした。"
      };
    }

    return {
      status: "success",
      messageId: parsed.data.messageId,
      isSaved: true,
    };
  }

  const { error } = await supabase
    .from("saved_consultation_cards")
    .delete()
    .eq("message_id", parsed.data.messageId)
    .eq("account_id", accountContext.currentAccount.id);

  if (error) {
    return {
      status: "error",
      message: "保存状態を更新できませんでした。"
    };
  }

  return {
    status: "success",
    messageId: parsed.data.messageId,
    isSaved: false,
  };
}









