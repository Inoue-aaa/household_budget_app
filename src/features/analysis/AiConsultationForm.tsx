"use client";

import type { Route } from "next";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  submitAiConsultationAction,
  toggleSavedConsultationCardAction,
  type AiConsultationTemplateKey,
} from "@/features/analysis/actions";
import {
  CONSULTATION_TEMPLATE_OPTIONS,
  resolveSuggestedGroups,
} from "@/features/analysis/insights";
import type {
  ConsultationMessageItem,
  ConsultationSessionDetail,
  ConsultationSessionItem,
  SavedConsultationCardItem,
} from "@/lib/finance/types";
import { formatCurrency, formatDisplayDate } from "@/lib/utils/format";

type AiConsultationFormProps = {
  defaultStartDate: string;
  defaultEndDate: string;
  initialSession: ConsultationSessionDetail | null;
  recentSessions: ConsultationSessionItem[];
  initialSavedCards: SavedConsultationCardItem[];
};

function buildBudgetHref(message: ConsultationMessageItem) {
  return (message.primaryCategoryId
    ? `/home/budget?focusCategory=${message.primaryCategoryId}#budget-category-${message.primaryCategoryId}`
    : "/home/budget") as Route;
}

function toSessionItem(session: ConsultationSessionDetail): ConsultationSessionItem {
  return {
    id: session.id,
    startDate: session.startDate,
    endDate: session.endDate,
    periodLabel: session.periodLabel,
    title: session.title,
    lastQuestion: session.lastQuestion,
    lastAnswerSummary: session.lastAnswerSummary,
    latestTemplateKey: session.latestTemplateKey,
    lastConsultedAt: session.lastConsultedAt,
  };
}

export function AiConsultationForm({
  defaultStartDate,
  defaultEndDate,
  initialSession,
  recentSessions,
  initialSavedCards,
}: AiConsultationFormProps) {
  const [isPending, startTransition] = useTransition();
  const [isSavePending, startSaveTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(
    initialSession?.startDate ?? defaultStartDate,
  );
  const [endDate, setEndDate] = useState(initialSession?.endDate ?? defaultEndDate);
  const [templateQuestion, setTemplateQuestion] = useState<
    AiConsultationTemplateKey | ""
  >(initialSession?.latestTemplateKey ?? "");
  const [customQuestion, setCustomQuestion] = useState("");
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const [session, setSession] = useState<ConsultationSessionDetail | null>(initialSession);
  const [recentSessionItems, setRecentSessionItems] =
    useState<ConsultationSessionItem[]>(recentSessions);
  const [savedCards, setSavedCards] =
    useState<SavedConsultationCardItem[]>(initialSavedCards);
  const customQuestionRef = useRef<HTMLTextAreaElement | null>(null);
  const followUpQuestionRef = useRef<HTMLTextAreaElement | null>(null);

  const suggested = useMemo(
    () => resolveSuggestedGroups(startDate, endDate),
    [startDate, endDate],
  );
  const suggestedOptions = useMemo(
    () =>
      CONSULTATION_TEMPLATE_OPTIONS.filter((option) =>
        suggested.groups.includes(option.group),
      ),
    [suggested.groups],
  );

  function focusQuestionInput() {
    customQuestionRef.current?.focus();
  }

  function focusFollowUpInput() {
    followUpQuestionRef.current?.focus();
  }

  function updateRecentSessions(nextSession: ConsultationSessionDetail) {
    const nextItem = toSessionItem(nextSession);
    setRecentSessionItems((current) => [
      nextItem,
      ...current.filter((item) => item.id !== nextItem.id),
    ].slice(0, 8));
  }

  function updateSavedState(messageId: string, isSaved: boolean) {
    setSession((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        messages: current.messages.map((item) =>
          item.id === messageId ? { ...item, isSaved } : item,
        ),
      };
    });
  }

  function appendSavedCardFromMessage(messageId: string) {
    const message = session?.messages.find((item) => item.id === messageId);
    if (!message || !session) {
      return;
    }

    setSavedCards((current) => {
      if (current.some((item) => item.messageId === messageId)) {
        return current;
      }

      return [
        {
          id: `local-${messageId}`,
          sessionId: session.id,
          messageId,
          title: message.answerSummary ?? "相談の回答",
          answerSummary:
            message.answerSummary ??
            message.content.replace(/\s+/g, " ").trim().slice(0, 120),
          relatedCategoryId: message.primaryCategoryId,
          relatedCategoryName: message.primaryCategoryName,
          createdAt: message.createdAt,
          periodLabel: session.periodLabel,
        },
        ...current,
      ];
    });
  }

  function removeSavedCard(messageId: string) {
    setSavedCards((current) => current.filter((item) => item.messageId !== messageId));
  }

  async function handleToggleSaved(message: ConsultationMessageItem) {
    if (!session) {
      return;
    }

    const formData = new FormData();
    formData.set("sessionId", session.id);
    formData.set("messageId", message.id);
    formData.set("shouldSave", message.isSaved ? "false" : "true");

    startSaveTransition(async () => {
      const actionResult = await toggleSavedConsultationCardAction(formData);
      if (actionResult.status === "error") {
        setErrorMessage(actionResult.message);
        return;
      }

      updateSavedState(actionResult.messageId, actionResult.isSaved);
      if (actionResult.isSaved) {
        appendSavedCardFromMessage(actionResult.messageId);
      } else {
        removeSavedCard(actionResult.messageId);
      }
    });
  }

  function submitConsultation(params: {
    sessionId?: string | null;
    startDate: string;
    endDate: string;
    templateQuestion: AiConsultationTemplateKey | "";
    customQuestion: string;
    onSuccess?: () => void;
  }) {
    const hasTemplate = Boolean(params.templateQuestion);
    const hasCustom = params.customQuestion.trim().length > 0;

    if (!hasTemplate && !hasCustom) {
      setErrorMessage("テンプレ質問を選ぶか、自由質問を入力してください。");
      return;
    }

    setErrorMessage(null);

    const formData = new FormData();
    formData.set("sessionId", params.sessionId ?? "");
    formData.set("startDate", params.startDate);
    formData.set("endDate", params.endDate);
    formData.set("templateQuestion", params.templateQuestion);
    formData.set("customQuestion", params.customQuestion);

    startTransition(async () => {
      const actionResult = await submitAiConsultationAction(formData);

      if (actionResult.status === "success") {
        setSession(actionResult.session);
        updateRecentSessions(actionResult.session);
        params.onSuccess?.();
        return;
      }

      setErrorMessage(actionResult.message);
    });
  }

  return (
    <div className="field-stack analysis-consultation-stack">
      <section className="surface section-card">
        <h2 className="section-title">相談内容</h2>
        <p className="section-copy">開始日と終了日を選び、テンプレ質問か自由質問で相談できます。</p>
        <div style={{ height: 16 }} />
      <form
        className="field-stack"
        onSubmit={(event) => {
          event.preventDefault();
          submitConsultation({
            sessionId: null,
            startDate,
            endDate,
            templateQuestion,
            customQuestion,
            onSuccess: () => {
              setCustomQuestion("");
            },
          });
        }}
      >
        <div className="analysis-period-grid">
          <div className="field">
            <label htmlFor="analysis-start-date">開始日</label>
            <input
              id="analysis-start-date"
              name="startDate"
              onChange={(event) => setStartDate(event.target.value)}
              type="date"
              value={startDate}
            />
          </div>
          <div className="field">
            <label htmlFor="analysis-end-date">終了日</label>
            <input
              id="analysis-end-date"
              name="endDate"
              onChange={(event) => setEndDate(event.target.value)}
              type="date"
              value={endDate}
            />
          </div>
        </div>

        <div className="surface section-card ai-consult-recommend-card">
          <div className="field-stack">
            <div>
              <h2 className="section-title">{suggested.heading}</h2>
              <p className="section-copy">
                期間に合わせて、使いやすい質問を先に選べます。
              </p>
            </div>

            <div className="ai-template-chip-list">
              {suggestedOptions.map((option) => (
                <button
                  className="button button-secondary compact-button ai-template-chip"
                  key={option.value}
                  onClick={() => setTemplateQuestion(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="field">
          <label htmlFor="analysis-template-question">テンプレ質問</label>
          <select
            id="analysis-template-question"
            name="templateQuestion"
            onChange={(event) =>
              setTemplateQuestion(
                (event.target.value as AiConsultationTemplateKey | "") ?? "",
              )
            }
            value={templateQuestion}
          >
            <option value="">選択してください</option>
            {CONSULTATION_TEMPLATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="analysis-custom-question">自由質問</label>
          <textarea
            id="analysis-custom-question"
            name="customQuestion"
            onChange={(event) => setCustomQuestion(event.target.value)}
            placeholder="気になることがあれば、自由に入力できます。"
            ref={customQuestionRef}
            rows={4}
            value={customQuestion}
          />
        </div>

        {errorMessage ? <p className="form-message form-message-error">{errorMessage}</p> : null}

        <button className="button" disabled={isPending} type="submit">
          {isPending ? "AIに相談中..." : session ? "新しい内容で相談する" : "AIに相談する"}
        </button>
      </form>
      </section>

      {session ? (
        <div className="surface section-card analysis-answer-card">
          <div className="field-stack">
            <div className="section-card-header-row">
              <div>
                <p className="eyebrow">CONSULTATION</p>
                <h2 className="section-title">相談結果</h2>
                <p className="section-copy">{session.periodLabel}</p>
              </div>
              <button
                className="button button-secondary compact-button action-button action-button-secondary"
                onClick={focusQuestionInput}
                type="button"
              >
                新しい相談
              </button>
            </div>

            <div className="field-stack analysis-message-list">
              {session.messages.map((message) =>
                message.role === "user" ? (
                  <div className="analysis-message-card" key={message.id}>
                    <p className="eyebrow">QUESTION</p>
                    <p className="section-copy analysis-message-question">{message.content}</p>
                  </div>
                ) : (
                  <div className="analysis-message-card" key={message.id}>
                    <div className="section-card-header-row">
                      <div>
                        <p className="eyebrow">ANSWER</p>
                        <h3 className="section-title analysis-answer-subtitle">AIの回答</h3>
                      </div>
                      <button
                        className="button button-secondary compact-button action-button action-button-secondary analysis-save-button"
                        disabled={isSavePending}
                        onClick={() => handleToggleSaved(message)}
                        type="button"
                      >
                        {message.isSaved ? "保存済み" : "保存"}
                      </button>
                    </div>

                    <div className="analysis-answer-body">{message.content}</div>

                    {message.detectedInsights.length > 0 ? (
                      <div className="analysis-answer-evidence">
                        <div>
                          <p className="eyebrow">SUGGESTIONS</p>
                          <h3 className="section-title analysis-answer-subtitle">
                            見直しポイント
                          </h3>
                        </div>
                        <div className="analysis-insight-list">
                          {message.detectedInsights.map((item) => (
                            <div className="analysis-insight-card" key={item.id}>
                              <div className="analysis-insight-copy">
                                <p className="list-title">{item.title}</p>
                                <p className="list-meta">{item.summary}</p>
                              </div>
                              {item.relatedCategoryId ? (
                                <div className="analysis-inline-actions">
                                  <Link
                                    className="button button-secondary compact-button action-button action-button-secondary analysis-inline-action"
                                    href={
                                      `/home/budget?focusCategory=${item.relatedCategoryId}#budget-category-${item.relatedCategoryId}` as Route
                                    }
                                  >
                                    予算を見直す
                                  </Link>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {message.evidenceSummary ? (
                      <div className="analysis-answer-evidence">
                        <div>
                          <p className="eyebrow">EVIDENCE</p>
                          <h3 className="section-title analysis-answer-subtitle">根拠</h3>
                        </div>

                        <div className="analysis-answer-summary-grid">
                          <div className="analysis-answer-summary-item">
                            <span className="list-meta">対象期間</span>
                            <strong>{session.periodLabel}</strong>
                          </div>
                          <div className="analysis-answer-summary-item">
                            <span className="list-meta">総支出</span>
                            <strong>{formatCurrency(message.evidenceSummary.totalAmount)}</strong>
                          </div>
                          <div className="analysis-answer-summary-item">
                            <span className="list-meta">前期間との差</span>
                            <strong>
                              {formatCurrency(message.evidenceSummary.differenceAmount)}
                            </strong>
                          </div>
                          <div className="analysis-answer-summary-item">
                            <span className="list-meta">増減率</span>
                            <strong>
                              {message.evidenceSummary.changeRate != null
                                ? `${Math.round(message.evidenceSummary.changeRate * 100)}%`
                                : "比較なし"}
                            </strong>
                          </div>
                        </div>

                        <div className="list">
                          <div className="list-row">
                            <div>
                              <p className="list-title">支出上位カテゴリ</p>
                              <p className="list-meta">
                                この期間で金額が大きいカテゴリを表示しています。
                              </p>
                            </div>
                          </div>
                          {message.evidenceSummary.topCategories.length > 0 ? (
                            message.evidenceSummary.topCategories.map((item) => (
                              <div className="list-row" key={item.categoryName}>
                                <div>
                                  <p className="list-title">{item.categoryName}</p>
                                </div>
                                <strong>{formatCurrency(item.totalAmount)}</strong>
                              </div>
                            ))
                          ) : (
                            <div className="list-row">
                              <div>
                                <p className="list-meta">
                                  表示できるカテゴリはまだありません。
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}

                    <div className="analysis-answer-actions">
                      <Link
                        className="button button-secondary compact-button action-button action-button-secondary"
                        href={buildBudgetHref(message)}
                      >
                        予算を見直す
                      </Link>
                    </div>
                  </div>
                ),
              )}
            </div>

            <div className="analysis-followup-card">
              <div className="field-stack">
                <div>
                  <p className="eyebrow">FOLLOW UP</p>
                  <h3 className="section-title analysis-answer-subtitle">追加で質問する</h3>
                  <p className="section-copy">
                    同じ期間の相談を続けたいときは、そのまま追加入力できます。
                  </p>
                </div>

                <div className="field">
                  <textarea
                    id="analysis-followup-question"
                    onChange={(event) => setFollowUpQuestion(event.target.value)}
                    placeholder="気になる点を続けて質問できます。"
                    ref={followUpQuestionRef}
                    rows={3}
                    value={followUpQuestion}
                  />
                </div>

                <div className="analysis-followup-actions">
                  <button
                    className="button button-secondary compact-button action-button action-button-secondary"
                    onClick={() =>
                      submitConsultation({
                        sessionId: session.id,
                        startDate: session.startDate,
                        endDate: session.endDate,
                        templateQuestion: "",
                        customQuestion: followUpQuestion,
                        onSuccess: () => {
                          setFollowUpQuestion("");
                          focusFollowUpInput();
                        },
                      })
                    }
                    disabled={isPending}
                    type="button"
                  >
                    {isPending ? "送信中..." : "追加で質問する"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {recentSessionItems.length > 0 ? (
        <div className="surface section-card">
          <div className="section-card-header-row">
            <h2 className="section-title">過去の相談</h2>
          </div>
          <div className="list">
            {recentSessionItems.map((item) => (
              <Link
                className="list-row list-row-link"
                href={`/expenses/ai?sessionId=${item.id}` as Route}
                key={item.id}
              >
                <div>
                  <p className="list-title">{item.title}</p>
                  <p className="list-meta">
                    {item.periodLabel} ・ {formatDisplayDate(item.lastConsultedAt.slice(0, 10))}
                  </p>
                </div>
                <strong>›</strong>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {savedCards.length > 0 ? (
        <div className="surface section-card">
          <div className="section-card-header-row">
            <h2 className="section-title">保存した回答</h2>
          </div>
          <div className="list">
            {savedCards.map((item) => (
              <Link
                className="list-row list-row-link"
                href={`/expenses/ai?sessionId=${item.sessionId}` as Route}
                key={item.id}
              >
                <div>
                  <p className="list-title">{item.title}</p>
                  <p className="list-meta">
                    {item.periodLabel}
                    {item.relatedCategoryName ? ` ・ ${item.relatedCategoryName}` : ""}
                  </p>
                  <p className="list-meta">{item.answerSummary}</p>
                </div>
                <strong>›</strong>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
