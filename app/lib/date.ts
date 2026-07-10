export const PRICE_RETENTION_DAYS = 90;

export type JalaliDate = { jd: number; jm: number; jy: number };

function div(a: number, b: number) {
  return Math.trunc(a / b);
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

export function localDateKey(value = new Date()): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function dateFromLocalKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function addLocalDays(value: string, amount: number): string {
  const date = dateFromLocalKey(value);
  date.setDate(date.getDate() + amount);
  return localDateKey(date);
}

export function compareDateKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

export function localDateRange(from: string, to: string): string[] {
  if (from > to) return [];
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = addLocalDays(cursor, 1);
  }
  return dates;
}

export function retentionStart(today = localDateKey(), days = PRICE_RETENTION_DAYS): string {
  return addLocalDays(today, -(days - 1));
}

export function pruneDateWindow<T extends { date: string }>(
  records: T[],
  today = localDateKey(),
  days = PRICE_RETENTION_DAYS,
): T[] {
  const from = retentionStart(today, days);
  return records.filter((record) => record.date >= from && record.date <= today);
}

export function transactionDateKey(value: { date: string; dateKey?: string }): string {
  if (value.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(value.dateKey)) return value.dateKey;
  const legacyPrefix = value.date.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(legacyPrefix)) return legacyPrefix;
  return localDateKey(new Date(value.date));
}

export function localDateTimeForKey(value: string): string {
  return dateFromLocalKey(value).toISOString();
}

export function daysBetween(from: string, to: string): number {
  const fromDate = dateFromLocalKey(from);
  const toDate = dateFromLocalKey(to);
  const cursor = new Date(fromDate);
  let count = 0;
  const direction = from <= to ? 1 : -1;
  while (localDateKey(cursor) !== localDateKey(toDate)) {
    cursor.setDate(cursor.getDate() + direction);
    count += direction;
  }
  return count;
}

export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate {
  const gDaysInMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy: number;
  if (gy > 1600) {
    jy = 979;
    gy -= 1600;
  } else {
    jy = 0;
    gy -= 621;
  }
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 365 * gy + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) - 80 + gd + gDaysInMonth[gm - 1];
  jy += 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jd, jm, jy };
}

export function dateKeyToJalali(value: string): JalaliDate {
  const [gy, gm, gd] = value.split("-").map(Number);
  return gregorianToJalali(gy, gm, gd);
}

export function jalaliApiDate(value: string): string {
  const { jd, jm, jy } = dateKeyToJalali(value);
  return `${jy}/${pad(jm)}/${pad(jd)}`;
}

export function compressDateRanges(dates: string[]): Array<{ from: string; to: string }> {
  const sorted = [...new Set(dates)].sort();
  const ranges: Array<{ from: string; to: string }> = [];
  for (const date of sorted) {
    const previous = ranges.at(-1);
    if (previous && addLocalDays(previous.to, 1) === date) {
      previous.to = date;
    } else {
      ranges.push({ from: date, to: date });
    }
  }
  return ranges;
}
