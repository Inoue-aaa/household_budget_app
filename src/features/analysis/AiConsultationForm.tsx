"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  submitAiConsultationAction,
  type AiConsultationActionResult,
  type AiConsultationTemplateKey,
} from "@/features/analysis/actions";
import { formatCurrency } from "@/lib/utils/format";

type AiConsultationFormProps = {
  defaultStartDate: string;
  defaultEndDate: string;
};

type TemplateOption = {
  value: AiConsultationTemplateKey;
  label: string;
  group: "monthly" | "comparison" | "budget";
};

const AI_CONSULTATION_TEMPLATE_OPTIONS: TemplateOption[] = [
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
];

function resolveSuggestedGroups(startDate: string, endDate: string) {
  const today = new Date();
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diffDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const sameMonth =
    start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  const isCurrentMonth =
    sameMonth &&
    start.getFullYear() === today.getFullYear() &&
    start.getMonth() === today.getMonth();

  if (isCurrentMonth) {
    return {
      heading: "今月におすすめ",
      groups: ["monthly", "budget"] as const,
    };
  }

  if (sameMonth && diffDays >= 28) {
    return {
      heading: "振り返りにおすすめ",
      groups: ["comparison", "monthly"] as const,
    };
  }

  return {
    heading: "おすすめ質問",
    groups: ["monthly", "comparison"] as const,
  };
}

export function AiConsultationForm({
  defaultStartDate,
  defaultEndDate,
}: AiConsultationFormProps) {
  const [result, setResult] = useState<AiConsultationActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const suggested = useMemo(
    () => resolveSuggestedGroups(startDate, endDate),
    [startDate, endDate],
  );
  const suggestedOptions = useMemo(
    () =>
      AI_CONSULTATION_TEMPLATE_OPTIONS.filter((option) =>
        (suggested.groups as readonly TemplateOption["group"][]).includes(option.group),
      ),
    [suggested.groups],
  );
  const recommendedCategory = result?.status === "success" ? result.primaryCategoryName : null;
  const budgetReviewHref = recommendedCategory
    ? {
        pathname: "/home/budget" as const,
        query: { focusCategory: recommendedCategory },
      }
    : { pathname: "/home/budget" as const };

  return (
    <form
      className="field-stack"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setResult(null);

        startTransition(async () => {
          const actionResult = await submitAiConsultationAction(formData);
          setResult(actionResult);
        });
      }}
    >
      <div className="analysis-period-grid">
        <div className="field">
          <label htmlFor="analysis-start-date">開始日</label>
          <input
            defaultValue={defaultStartDate}
            id="analysis-start-date"
            name="startDate"
            type="date"
            onChange={(event) => setStartDate(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="analysis-end-date">終了日</label>
          <input
            defaultValue={defaultEndDate}
            id="analysis-end-date"
            name="endDate"
            type="date"
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>
      </div>

      <div className="surface section-card ai-consult-recommend-card">
        <div className="field-stack">
          <div>
            <h2 className="section-title">{suggested.heading}</h2>
            <p className="section-copy">
              今の期間に合わせて、使いやすい質問を先に選べます。
            </p>
          </div>

          <div className="ai-template-chip-list">
            {suggestedOptions.map((option) => (
              <button
                key={option.value}
                className="button button-secondary compact-button ai-template-chip"
                type="button"
                onClick={() => {
                  const select = document.getElementById(
                    "analysis-template-question",
                  ) as HTMLSelectElement | null;
                  if (select) {
                    select.value = option.value;
                    select.dispatchEvent(new Event("change", { bubbles: true }));
                  }
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="field">
        <label htmlFor="analysis-template-question">テンプレ質問</label>
        <select defaultValue="" id="analysis-template-question" name="templateQuestion">
          <option value="">選択してください</option>
          {AI_CONSULTATION_TEMPLATE_OPTIONS.map((option) => (
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
          placeholder="気になることがあれば、自由に入力できます。"
          rows={4}
        />
      </div>

      {result?.status === "error" ? (
        <p className="form-message form-message-error">{result.message}</p>
      ) : null}

      <button className="button" disabled={isPending} type="submit">
        {isPending ? "AIへ送信中..." : "AIに相談する"}
      </button>

      <div className="surface section-card analysis-answer-card">
        {result?.status === "success" ? (
          <div className="field-stack">
            <div>
              <p className="eyebrow">CONSULTATION</p>
              <h2 className="section-title">AIの回答</h2>
              <p className="section-copy">{result.question}</p>
            </div>

            <div className="analysis-answer-summary-grid">
              <div className="analysis-answer-summary-item">
                <span className="list-meta">対象期間</span>
                <strong>{result.periodLabel}</strong>
              </div>
              <div className="analysis-answer-summary-item">
                <span className="list-meta">総支出</span>
                <strong>{formatCurrency(result.evidenceSummary.totalAmount)}</strong>
              </div>
            </div>

            <div className="analysis-answer-body">{result.answer}</div>

            {result.detectedInsights.length > 0 ? (
              <div className="analysis-answer-evidence">
                <div>
                  <p className="eyebrow">SUGGESTIONS</p>
                  <h3 className="section-title analysis-answer-subtitle">
                    見直しポイント
                  </h3>
                </div>

                <div className="list">
                  {result.detectedInsights.map((item) => (
                    <div className="list-row" key={item.id}>
                      <div>
                        <p className="list-title">{item.title}</p>
                        <p className="list-meta">{item.summary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="analysis-answer-evidence">
              <div>
                <p className="eyebrow">EVIDENCE</p>
                <h3 className="section-title analysis-answer-subtitle">根拠</h3>
              </div>

              <div className="analysis-answer-summary-grid">
                <div className="analysis-answer-summary-item">
                  <span className="list-meta">前期間との差</span>
                  <strong>{formatCurrency(result.evidenceSummary.differenceAmount)}</strong>
                </div>
                <div className="analysis-answer-summary-item">
                  <span className="list-meta">増減率</span>
                  <strong>
                    {result.evidenceSummary.changeRate != null
                      ? `${Math.round(result.evidenceSummary.changeRate * 100)}%`
                      : "比較なし"}
                  </strong>
                </div>
              </div>

              <div className="list">
                <div className="list-row">
                  <div>
                    <p className="list-title">支出上位カテゴリ</p>
                    <p className="list-meta">
                      この期間で金額が大きい順に表示しています。
                    </p>
                  </div>
                </div>
                {result.evidenceSummary.topCategories.length > 0 ? (
                  result.evidenceSummary.topCategories.map((item) => (
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
                      <p className="list-meta">表示できるカテゴリはまだありません</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="analysis-answer-actions">
              <Link
                className="button button-secondary compact-button action-button action-button-secondary"
                href={budgetReviewHref}
              >
                予算を見直す
              </Link>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <p className="section-title">まだ相談していません</p>
            <p className="section-copy">
              期間と質問を選ぶと、集計済みの支出データをもとにAIへ相談できます。
            </p>
          </div>
        )}
      </div>
    </form>
  );
}
