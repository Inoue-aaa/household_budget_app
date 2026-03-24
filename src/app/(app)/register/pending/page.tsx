import Link from "next/link";
import { NoticeBanner } from "@/components/NoticeBanner";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionCard } from "@/components/SectionCard";
import { PendingImportGroupDeleteForm } from "./PendingImportGroupDeleteForm";
import { getPendingImportsPageSnapshot } from "@/lib/finance/queries";
import { getPendingNotice } from "@/lib/ui/notices";
import { formatDateTime, formatDisplayDate, formatSourceLabel } from "@/lib/utils/format";

type PendingImportsPageProps = {
  searchParams: Promise<{
    notice?: string;
  }>;
};

export default async function PendingImportsPage({ searchParams }: PendingImportsPageProps) {
  const snapshot = await getPendingImportsPageSnapshot();
  const { notice } = await searchParams;
  const pendingNotice = getPendingNotice(notice);

  return (
    <div className="page-stack">
      {pendingNotice ? (
        <NoticeBanner
          tone={pendingNotice.tone}
          title={pendingNotice.title}
          description={pendingNotice.description}
        />
      ) : null}

      <ScreenHeader
        eyebrow="Pending"
        title="未確認データ"
        description="まだ確定保存していない取り込みを一覧で確認できます。途中から review に戻るときに使います。"
      />

      <SectionCard
        title="確認待ちの取り込み"
        description="未確定の import_group を表示しています。不要な取り込みはここから削除できます。"
      >
        {snapshot.groups.length === 0 ? (
          <div className="empty-state">
            <p className="section-title">未確認データはありません</p>
            <p className="section-copy">
              レシートやクレジット明細の読み取り結果を途中で止めたときに、ここから再開できます。
            </p>
            <div style={{ height: 14 }} />
            <Link className="button" href="/register">
              登録方法を見る
            </Link>
          </div>
        ) : (
          <div className="list">
            {snapshot.groups.map((group) => (
              <section className="expense-card" key={group.importGroupId}>
                <div className="expense-card-main">
                  <div className="expense-card-overline">
                    <span className="pill pill-accent">{formatSourceLabel(group.sourceType)}</span>
                    <span className="expense-card-date">{formatDateTime(group.createdAt)}</span>
                  </div>

                  <div>
                    <p className="expense-group-label">確認待ちの取り込み</p>
                    <p className="list-title">{group.representativeLabel}</p>
                    <p className="list-meta">
                      draft 件数: {group.draftCount}件
                      {group.occurredOn ? ` ・ 利用日: ${formatDisplayDate(group.occurredOn)}` : ""}
                    </p>
                  </div>

                  <div className="pending-actions">
                    <Link
                      className="button compact-button pending-card-action"
                      href={`/register/review/${group.importGroupId}`}
                    >
                      確認を続ける
                    </Link>
                    <PendingImportGroupDeleteForm
                      importGroupId={group.importGroupId}
                      sourceType={group.sourceType}
                    />
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
