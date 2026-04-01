import type { RecurringExpenseRow } from "@/lib/finance/db-types";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

type ScheduleShape = Pick<
  RecurringExpenseRow,
  "schedule_day" | "schedule_time" | "start_date" | "end_date"
>;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toJstDate(date: Date) {
  return new Date(date.getTime() + JST_OFFSET_MS);
}

function fromJstParts(year: number, month: number, day: number, hour: number, minute: number) {
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute));
}

function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function getScheduleHourAndMinute(scheduleTime: string) {
  const [hourText = "09", minuteText = "00"] = scheduleTime.slice(0, 5).split(":");
  return {
    hour: Number(hourText),
    minute: Number(minuteText),
  };
}

function formatDateOnly(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function formatDateFromJst(date: Date) {
  const jstDate = toJstDate(date);
  return formatDateOnly(
    jstDate.getUTCFullYear(),
    jstDate.getUTCMonth() + 1,
    jstDate.getUTCDate(),
  );
}

function addMonths(year: number, month: number, diff: number) {
  const date = new Date(Date.UTC(year, month - 1 + diff, 1));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  };
}

export function resolveEffectiveScheduleDay(scheduleDay: number, year: number, month: number) {
  return Math.min(scheduleDay, getDaysInMonth(year, month));
}

export function buildScheduledOccurrence(
  recurringExpense: ScheduleShape,
  year: number,
  month: number,
) {
  const day = resolveEffectiveScheduleDay(recurringExpense.schedule_day, year, month);
  const { hour, minute } = getScheduleHourAndMinute(recurringExpense.schedule_time);
  const occurredOn = formatDateOnly(year, month, day);

  return {
    targetMonth: formatDateOnly(year, month, 1),
    occurredOn,
    scheduledAt: fromJstParts(year, month, day, hour, minute),
  };
}

export function computeNextScheduledAt(
  recurringExpense: ScheduleShape,
  reference = new Date(),
): string | null {
  const currentJst = toJstDate(reference);
  const currentYear = currentJst.getUTCFullYear();
  const currentMonth = currentJst.getUTCMonth() + 1;

  for (let index = 0; index < 24; index += 1) {
    const { year, month } = addMonths(currentYear, currentMonth, index);
    const occurrence = buildScheduledOccurrence(recurringExpense, year, month);

    if (recurringExpense.start_date && occurrence.occurredOn < recurringExpense.start_date) {
      continue;
    }

    if (recurringExpense.end_date && occurrence.occurredOn > recurringExpense.end_date) {
      return null;
    }

    if (occurrence.scheduledAt.getTime() > reference.getTime()) {
      return occurrence.scheduledAt.toISOString();
    }
  }

  return null;
}

export function getCurrentMonthOccurrence(recurringExpense: ScheduleShape, reference = new Date()) {
  const currentJst = toJstDate(reference);
  const year = currentJst.getUTCFullYear();
  const month = currentJst.getUTCMonth() + 1;
  return buildScheduledOccurrence(recurringExpense, year, month);
}

export function getUpcomingOccurrenceWithinDays(
  recurringExpense: ScheduleShape,
  days = 7,
  reference = new Date(),
) {
  const currentJst = toJstDate(reference);
  const currentYear = currentJst.getUTCFullYear();
  const currentMonth = currentJst.getUTCMonth() + 1;
  const today = formatDateFromJst(reference);

  const isVisibleWithinWindow = (occurredOn: string) => {
    const visibleUntil = formatDateFromJst(
      new Date(new Date(`${occurredOn}T00:00:00+09:00`).getTime() + days * 24 * 60 * 60 * 1000),
    );

    return occurredOn <= today && today <= visibleUntil;
  };

  const previousMonthParts = addMonths(currentYear, currentMonth, -1);
  const previousOccurrence = buildScheduledOccurrence(
    recurringExpense,
    previousMonthParts.year,
    previousMonthParts.month,
  );
  if (
    isOccurrenceWithinRange(recurringExpense, previousOccurrence.occurredOn) &&
    isVisibleWithinWindow(previousOccurrence.occurredOn)
  ) {
    return previousOccurrence;
  }

  const currentOccurrence = buildScheduledOccurrence(recurringExpense, currentYear, currentMonth);
  if (
    isOccurrenceWithinRange(recurringExpense, currentOccurrence.occurredOn) &&
    isVisibleWithinWindow(currentOccurrence.occurredOn)
  ) {
    return currentOccurrence;
  }

  return null;
}

export function isOccurrenceWithinRange(recurringExpense: ScheduleShape, occurredOn: string) {
  if (recurringExpense.start_date && occurredOn < recurringExpense.start_date) {
    return false;
  }

  if (recurringExpense.end_date && occurredOn > recurringExpense.end_date) {
    return false;
  }

  return true;
}
