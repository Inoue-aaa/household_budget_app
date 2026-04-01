import { getAuthenticatedAccountContext } from "@/lib/accounts/queries";
import type {
  ConsultationMessageRow,
  ConsultationSessionRow,
  SavedConsultationCardRow,
} from "@/lib/finance/db-types";
import { listCategories, getAnalysisSnapshot } from "@/lib/finance/queries";
import type {
  AiConsultationPageSnapshot,
  ConsultationEvidenceSummary,
  ConsultationInsight,
  ConsultationMessageItem,
  ConsultationSessionDetail,
  ConsultationSessionItem,
  SavedConsultationCardItem,
} from "@/lib/finance/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatDisplayDate, formatMonthLabel, monthDateRange } from "@/lib/utils/format";
import { buildDetectedInsights } from "@/features/analysis/insights";

function createFallbackAccount() {
  return {
    currentAccount: {
      id: "fallback-account",
      slug: "atsuki" as const,
      name: "あつき",
      colorKey: "blue" as const,
      sortOrder: 1,
    },
    accounts: [
      {
        id: "fallback-account",
        slug: "atsuki" as const,
        name: "あつき",
        colorKey: "blue" as const,
        sortOrder: 1,
      },
    ],
  };
}

function formatPeriodLabel(startDate: string, endDate: string) {
  return `${formatDisplayDate(startDate)} 〜 ${formatDisplayDate(endDate)}`;
}

function isSamePeriod(
  snapshot: { period: { startDate: string; endDate: string } },
  startDate?: string,
  endDate?: string,
) {
  return (
    typeof startDate === "string" &&
    typeof endDate === "string" &&
    snapshot.period.startDate === startDate &&
    snapshot.period.endDate === endDate
  );
}

function normalizeEvidenceSummary(value: unknown): ConsultationEvidenceSummary | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const typed = value as Record<string, unknown>;
  const topCategories = Array.isArray(typed.topCategories)
    ? typed.topCategories
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }
          const row = item as Record<string, unknown>;
          if (
            typeof row.categoryName !== "string" ||
            typeof row.totalAmount !== "number"
          ) {
            return null;
          }
          return {
            categoryName: row.categoryName,
            totalAmount: row.totalAmount,
          };
        })
        .filter(
          (
            item,
          ): item is {
            categoryName: string;
            totalAmount: number;
          } => item != null,
        )
    : [];

  return {
    totalAmount: typeof typed.totalAmount === "number" ? typed.totalAmount : 0,
    topCategories,
    differenceAmount:
      typeof typed.differenceAmount === "number" ? typed.differenceAmount : 0,
    changeRate: typeof typed.changeRate === "number" ? typed.changeRate : null,
  };
}

function normalizeInsights(value: unknown): ConsultationInsight[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const typed = item as Record<string, unknown>;
      if (
        typeof typed.id !== "string" ||
        typeof typed.kind !== "string" ||
        typeof typed.title !== "string" ||
        typeof typed.summary !== "string" ||
        typeof typed.severity !== "string"
      ) {
        return null;
      }

      return {
        id: typed.id,
        kind: typed.kind as ConsultationInsight["kind"],
        title: typed.title,
        summary: typed.summary,
        relatedCategoryId:
          typeof typed.relatedCategoryId === "string" ? typed.relatedCategoryId : null,
        relatedCategoryName:
          typeof typed.relatedCategoryName === "string"
            ? typed.relatedCategoryName
            : null,
        severity: typed.severity as ConsultationInsight["severity"],
        supportingMetrics:
          typed.supportingMetrics && typeof typed.supportingMetrics === "object"
            ? (typed.supportingMetrics as Record<string, number | string | null>)
            : {},
      } satisfies ConsultationInsight;
    })
    .filter((item): item is ConsultationInsight => item != null);
}

function buildSessionItem(row: ConsultationSessionRow): ConsultationSessionItem {
  return {
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
    periodLabel: formatPeriodLabel(row.start_date, row.end_date),
    title: row.title ?? row.last_question ?? "AI相談",
    lastQuestion: row.last_question,
    lastAnswerSummary: row.last_answer_summary,
    latestTemplateKey: row.latest_template_key as ConsultationSessionItem["latestTemplateKey"],
    lastConsultedAt: row.last_consulted_at,
  };
}

function buildMessageItem(
  row: ConsultationMessageRow,
  categoryMap: Map<string, string>,
  savedMessageIds: Set<string>,
): ConsultationMessageItem {
  const metadata = row.metadata ?? {};
  const typedMetadata = typeof metadata === "object" ? metadata : {};
  const primaryCategoryId =
    typeof (typedMetadata as Record<string, unknown>).primaryCategoryId === "string"
      ? ((typedMetadata as Record<string, unknown>).primaryCategoryId as string)
      : null;
  const primaryCategoryName =
    typeof (typedMetadata as Record<string, unknown>).primaryCategoryName === "string"
      ? ((typedMetadata as Record<string, unknown>).primaryCategoryName as string)
      : primaryCategoryId
        ? (categoryMap.get(primaryCategoryId) ?? null)
        : null;

  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
    templateKey: row.template_key as ConsultationMessageItem["templateKey"],
    answerSummary: row.answer_summary,
    evidenceSummary: normalizeEvidenceSummary(
      (typedMetadata as Record<string, unknown>).evidenceSummary,
    ),
    detectedInsights: normalizeInsights(
      (typedMetadata as Record<string, unknown>).detectedInsights,
    ),
    primaryCategoryId,
    primaryCategoryName,
    isSaved: savedMessageIds.has(row.id),
  };
}

function buildSavedCardItem(
  row: SavedConsultationCardRow,
  sessionMap: Map<string, ConsultationSessionRow>,
  categoryMap: Map<string, string>,
): SavedConsultationCardItem {
  const session = sessionMap.get(row.session_id);
  const fallbackPeriodLabel = session
    ? formatPeriodLabel(session.start_date, session.end_date)
    : "対象期間";

  return {
    id: row.id,
    sessionId: row.session_id,
    messageId: row.message_id,
    title: row.title ?? "保存した回答",
    answerSummary: row.answer_summary ?? "保存した回答を開いて確認できます。",
    relatedCategoryId: row.related_category_id,
    relatedCategoryName: row.related_category_id
      ? (categoryMap.get(row.related_category_id) ?? null)
      : null,
    createdAt: row.created_at,
    periodLabel: fallbackPeriodLabel,
  };
}

export async function getAiConsultationPageSnapshot(params?: {
  startDate?: string;
  endDate?: string;
  sessionId?: string;
}): Promise<AiConsultationPageSnapshot> {
  try {
    const accountContext = await getAuthenticatedAccountContext();
    const fallbackAccount = createFallbackAccount();

    if (!accountContext) {
      const fallbackSnapshot = await getAnalysisSnapshot({
        startDate: params?.startDate,
        endDate: params?.endDate,
      });

      return {
        account: fallbackAccount,
        defaultStartDate: fallbackSnapshot.period.startDate,
        defaultEndDate: fallbackSnapshot.period.endDate,
        activeSession: null,
        recentSessions: [],
        savedCards: [],
        monthlySuggestions: [],
        monthLabel: formatMonthLabel(fallbackSnapshot.period.startDate),
      };
    }

    const [supabase, categories] = await Promise.all([
      createServerSupabaseClient(),
      listCategories(),
    ]);
    const categoryMap = new Map(categories.map((item) => [item.id, item.name]));

    const [
      { data: sessionRows },
      { data: savedRows },
      currentMonthSnapshot,
    ] = await Promise.all([
      supabase
        .from("consultation_sessions")
        .select(
          "id, user_id, account_id, start_date, end_date, latest_template_key, title, last_question, last_answer_summary, last_consulted_at, created_at, updated_at",
        )
        .eq("account_id", accountContext.currentAccount.id)
        .order("last_consulted_at", { ascending: false })
        .limit(8),
      supabase
        .from("saved_consultation_cards")
        .select(
          "id, session_id, message_id, user_id, account_id, title, answer_summary, related_category_id, created_at",
        )
        .eq("account_id", accountContext.currentAccount.id)
        .order("created_at", { ascending: false })
        .limit(8),
      getAnalysisSnapshot(),
    ]);

    const sessionRowList = (sessionRows ?? []) as ConsultationSessionRow[];
    const sessionMap = new Map(sessionRowList.map((row) => [row.id, row]));

    let activeSession: ConsultationSessionDetail | null = null;

    if (params?.sessionId && sessionMap.has(params.sessionId)) {
      const activeSessionRow = sessionMap.get(params.sessionId)!;
      const [{ data: messageRows }, { data: savedForSession }] = await Promise.all([
        supabase
          .from("consultation_messages")
          .select(
            "id, session_id, user_id, account_id, role, content, template_key, answer_summary, metadata, created_at",
          )
          .eq("session_id", activeSessionRow.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("saved_consultation_cards")
          .select("message_id")
          .eq("session_id", activeSessionRow.id),
      ]);

      const savedMessageIds = new Set(
        (savedForSession ?? [])
          .map((row) => row.message_id)
          .filter((value): value is string => typeof value === "string"),
      );

      activeSession = {
        ...buildSessionItem(activeSessionRow),
        messages: ((messageRows ?? []) as ConsultationMessageRow[]).map((row) =>
          buildMessageItem(row, categoryMap, savedMessageIds),
        ),
      };
    }

    const requestedSnapshot =
      activeSession == null
        ? isSamePeriod(currentMonthSnapshot, params?.startDate, params?.endDate)
          ? currentMonthSnapshot
          : await getAnalysisSnapshot({
              startDate: params?.startDate,
              endDate: params?.endDate,
            })
        : null;

    const effectivePeriod = activeSession
      ? {
          startDate: activeSession.startDate,
          endDate: activeSession.endDate,
        }
      : {
          startDate: requestedSnapshot?.period.startDate ?? currentMonthSnapshot.period.startDate,
          endDate: requestedSnapshot?.period.endDate ?? currentMonthSnapshot.period.endDate,
        };

    const currentMonth = monthDateRange(new Date()).start;

    return {
      account: accountContext,
      defaultStartDate: effectivePeriod.startDate,
      defaultEndDate: effectivePeriod.endDate,
      activeSession,
      recentSessions: sessionRowList.map(buildSessionItem),
      savedCards: ((savedRows ?? []) as SavedConsultationCardRow[]).map((row) =>
        buildSavedCardItem(row, sessionMap, categoryMap),
      ),
      monthlySuggestions: buildDetectedInsights(currentMonthSnapshot),
      monthLabel: formatMonthLabel(currentMonth),
    };
  } catch {
    const fallbackAccount = createFallbackAccount();
    const snapshot = await getAnalysisSnapshot({
      startDate: params?.startDate,
      endDate: params?.endDate,
    });

    return {
      account: fallbackAccount,
      defaultStartDate: snapshot.period.startDate,
      defaultEndDate: snapshot.period.endDate,
      activeSession: null,
      recentSessions: [],
      savedCards: [],
      monthlySuggestions: [],
      monthLabel: formatMonthLabel(snapshot.period.startDate),
    };
  }
}
