export interface DateRange {
  start: string;
  end: string;
}

export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function currentWeekRange(now = new Date()): DateRange {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  const start = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + 6);
  return { start, end: date.toISOString().slice(0, 10) };
}

export function currentMonthRange(now = new Date()): DateRange {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function daysInclusive(range: DateRange): number {
  const start = new Date(`${range.start}T00:00:00.000Z`).getTime();
  const end = new Date(`${range.end}T00:00:00.000Z`).getTime();
  return Math.floor((end - start) / 86_400_000) + 1;
}

