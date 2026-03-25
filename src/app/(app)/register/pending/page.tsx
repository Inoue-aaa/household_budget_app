import Link from "next/link";
import { NoticeBanner } from "@/components/NoticeBanner";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { PendingImportGroupDeleteForm } from "./PendingImportGroupDeleteForm";
import { getPendingImportsPageSnapshot } from "@/lib/finance/queries";
import { getPendingNotice } from "@/lib/ui/notices";
import {
  formatDateTime,
  formatDisplayDate,
  formatSourceLabel,
} from "@/lib/utils/format";

type PendingImportsPageProps = {
  searchParams: Promise<{
    notice?: string;
  }>;
};

export default async function PendingImportsPage({
  searchParams,
}: PendingImportsPageProps) {
  const snapshot = await getPendingImportsPageSnapshot();
  const { notice } = await searchParams;
  const pendingNotice = getPendingNotice(notice);

  return (
    <div className="page-stack">
      {pendingNotice ? (
        <NoticeBanner
          description={pendingNotice.description}
          title={pendingNotice.title}
          tone={pendingNotice.tone}
        />
      ) : null}

      <ScreenHeader
        eyebrow="Pending"
        title="未登録データ"
        description="登録が中断されたデータがあります。確認画面にて処理を続けることができます。"
      />

      <SectionCard title="確認待ちのデータ一覧">
        {snapshot.groups.length === 0 ? (
          <div className="empty-state">
            <p className="section-title">未登録データはありません</p>
            <p className="section-copy">
              レシートやクレジット明細の取り込みを始めると、ここから途中再開できます。
            </p>
            <div style={{ height: 14 }} />
            <Link className="button action-button action-button-primary" href="/register">
              登録方法を見る
            </Link>
          </div>
        ) : (
          <div className="list">
            {snapshot.groups.map((group) => (
              <section className="expense-card" key={group.importGroupId}>
                <div className="expense-card-main">
                  <div className="expense-card-overline">
                    <span className="pill pill-accent">
                      {formatSourceLabel(group.sourceType)}
                    </span>
                    <span className="expense-card-date">
                      {formatDateTime(group.createdAt)}
                    </span>
                  </div>

                  <div>
                    <p className="expense-group-label">確認待ちのデータ</p>
                    <p className="list-title">{group.representativeLabel}</p>
                    <p className="list-meta">
                      draft 件数: {group.draftCount}件
                      {group.occurredOn
                        ? ` ・ 利用日: ${formatDisplayDate(group.occurredOn)}`
                        : ""}
                    </p>
                  </div>

                  <div className="action-button-row action-button-row-centered expense-card-action-row">
                    <PendingImportGroupDeleteForm
                      importGroupId={group.importGroupId}
                    />
                    <Link
                      className="button compact-button action-button action-button-primary"
                      href={`/register/review/${group.importGroupId}`}
                    >
                      修正
                    </Link>
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="single-action-row">
        <Link
          className="button button-secondary compact-button action-button action-button-secondary bottom-back-button"
          href="/register"
        >
          back
        </Link>
      </div>
    </div>
  );
}
