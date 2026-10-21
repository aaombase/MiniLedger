/**
 * Calendar dates are 'YYYY-MM-DD' strings end to end. They are never turned into a local
 * `Date` for logic: `new Date('2026-11-04')` is UTC midnight, which shifts the day in other timezones.
 */

const MS_PER_DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The calendar date at `now` on the wall clock of `timeZone`, as 'YYYY-MM-DD'. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function parseParts(date: string): [number, number, number] | null {
  const match = DATE_PATTERN.exec(date);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** True for a well-formed, real calendar date ("2026-02-30" is rejected). */
export function isRealDate(date: string): boolean {
  const parts = parseParts(date);
  if (!parts) return false;
  const [y, m, d] = parts;
  const utc = new Date(Date.UTC(y, m - 1, d));
  return utc.getUTCFullYear() === y && utc.getUTCMonth() === m - 1 && utc.getUTCDate() === d;
}

function toUtcMs(date: string): number {
  const parts = parseParts(date);
  if (!parts) throw new Error(`Invalid date: ${date}`);
  const [y, m, d] = parts;
  return Date.UTC(y, m - 1, d);
}

export function addDays(date: string, days: number): string {
  return new Date(toUtcMs(date) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. Pure UTC math, so DST can't skew it. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

export function formatDate(date: string): string {
  const [y, m, d] = parseParts(date) ?? [0, 1, 0];
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatShortDate(date: string): string {
  const [, m, d] = parseParts(date) ?? [0, 1, 0];
  return `${d} ${MONTHS[m - 1]}`;
}
