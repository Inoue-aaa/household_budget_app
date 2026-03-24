import Link from "next/link";
import type { Route } from "next";
import type { DailySpendingItem } from "@/lib/finance/types";
import { formatCurrency } from "@/lib/utils/format";

type DailySpendingChartProps = {
  monthLabel: string;
  items: DailySpendingItem[];
  linkBasePath?: string;
};

export function DailySpendingChart({
  monthLabel,
  items,
  linkBasePath
}: DailySpendingChartProps) {
  const maxAmount = items.reduce((max, item) => Math.max(max, item.amount), 0);

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <p className="section-title">{monthLabel}の支出データはまだありません</p>
        <p className="section-copy">
          保存済み支出が増えると、日別の横棒グラフがここに表示されます。
        </p>
      </div>
    );
  }

  return (
    <div className="daily-chart">
      {items.map((item) => {
        const ratio = maxAmount > 0 ? item.amount / maxAmount : 0;
        const width = Math.max(ratio * 100, item.amount > 0 ? 6 : 0);
        const rowContent = (
          <>
            <div className="daily-chart-day">{item.day}日</div>
            <div className="daily-chart-track">
              <div
                className="daily-chart-bar"
                data-empty={item.amount === 0}
                style={{ width: `${width}%` }}
              />
            </div>
            <div className="daily-chart-amount">{formatCurrency(item.amount)}</div>
          </>
        );

        if (!linkBasePath) {
          return (
            <div className="daily-chart-row" key={item.date}>
              {rowContent}
            </div>
          );
        }

        return (
          <Link
            className="daily-chart-row daily-chart-row-link"
            href={`${linkBasePath}/${item.date}` as Route}
            key={item.date}
          >
            {rowContent}
          </Link>
        );
      })}
    </div>
  );
}
