import type { Loan } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map((x) => parseInt(x, 10));
  return [y, m, d];
}
function toUtcDays(date: string): number {
  const [y, m, d] = parts(date);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}
function fromUtcDays(days: number): string {
  const dt = new Date(days * 86_400_000);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isValidDateString(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return fromUtcDays(toUtcDays(date)) === date;
}

/** 'YYYY-MM-DD' for "now" in the given IANA time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export const addDays = (date: string, days: number): string => fromUtcDays(toUtcDays(date) + days);
export const daysBetween = (from: string, to: string): number => toUtcDays(to) - toUtcDays(from);

export function addMonths(date: string, months: number): string {
  const [y, m, d] = parts(date);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
}

export function formatDate(date: string): string {
  const [y, m, d] = parts(date);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
export function formatShortDate(date: string): string {
  const [, m, d] = parts(date);
  return `${d} ${MONTHS[m - 1]}`;
}
export function formatWeekdayDate(date: string): string {
  const wd = WEEKDAYS[new Date(toUtcDays(date) * 86_400_000).getUTCDay()];
  return `${wd}, ${formatDate(date)}`;
}

/** Convert an ISO timestamp to the calendar date in a time zone (display only). */
export const isoToLocalDate = (iso: string, timeZone = "Asia/Kolkata"): string => todayIn(timeZone, new Date(iso));

export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** "in 3 days" / "today" / "tomorrow" / "12 days ago" */
export function formatRelativeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${plural(days, "day")}` : `${plural(-days, "day")} ago`;
}

export function formatRelativeDue(loan: Loan): string {
  switch (loan.status) {
    case "repaid":
      return `Repaid ${loan.repaidAt ? formatShortDate(isoToLocalDate(loan.repaidAt)) : ""}`.trim();
    case "overdue":
      return `Overdue · ${plural(-(loan.daysUntilDue ?? 0), "day")}`;
    case "due_soon": {
      const d = loan.daysUntilDue ?? 0;
      return d === 0 ? "Due today" : d === 1 ? "Due tomorrow" : `Due in ${plural(d, "day")}`;
    }
    default:
      return `Due ${formatShortDate(loan.dueDate)}`;
  }
}
