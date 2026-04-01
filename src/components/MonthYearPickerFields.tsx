import type { ReportMonthOption } from "@/lib/finance/types";

type MonthYearPickerFieldsProps = {
  targetMonth: string;
  availableMonths: ReportMonthOption[];
};

function buildYearOptions(targetMonth: string, availableMonths: ReportMonthOption[]) {
  const targetYear = Number(targetMonth.slice(0, 4));
  const currentYear = new Date().getFullYear();
  const years = availableMonths
    .map((item) => Number(item.value.slice(0, 4)))
    .filter((value) => Number.isFinite(value));

  const minYear = years.length > 0 ? Math.min(...years, targetYear, currentYear) : Math.min(targetYear, currentYear);
  const maxYear = years.length > 0 ? Math.max(...years, targetYear, currentYear) : Math.max(targetYear, currentYear);

  return Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index).reverse();
}

export function MonthYearPickerFields({
  targetMonth,
  availableMonths,
}: MonthYearPickerFieldsProps) {
  const years = buildYearOptions(targetMonth, availableMonths);
  const selectedYear = targetMonth.slice(0, 4);
  const selectedMonth = targetMonth.slice(5, 7);

  return (
    <div className="month-year-picker-grid">
      <div className="field">
        <label htmlFor="year">年</label>
        <select defaultValue={selectedYear} id="year" name="year">
          {years.map((year) => (
            <option key={year} value={String(year)}>
              {year}年
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="monthNumber">月</label>
        <select defaultValue={selectedMonth} id="monthNumber" name="monthNumber">
          {Array.from({ length: 12 }, (_, index) => {
            const month = String(index + 1).padStart(2, "0");
            return (
              <option key={month} value={month}>
                {index + 1}月
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
}
