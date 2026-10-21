import { addMonths, daysBetween, isoToLocalDate } from "@/shared/dates";
import type { ActivityItem, Loan } from "@/shared/types";
import { groupByPerson, type Person } from "./people";

export interface MonthBar { key: string; label: string; lentMinor: number; collectedMinor: number }
export interface AgingBucket { label: string; minor: number; count: number }

export interface Insights {
  collectionRate: number; // 0..1, share of everything lent that has come back
  onTimeRate: number | null; // share of settled loans paid in full by the due date
  avgDaysToSettle: number | null;
  months: MonthBar[];
  aging: AgingBucket[];
  topOwed: Person[];
  largestOpen: Loan | null;
  settledCount: number;
}

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function computeInsights(loans: Loan[], activity: ActivityItem[], today: string): Insights {
  const lent = loans.reduce((s, l) => s + l.amountMinor, 0);
  const paid = loans.reduce((s, l) => s + l.paidMinor, 0);

  const settled = loans.filter((l) => l.status === "repaid");
  const settledDates = settled.map((l) => ({ loan: l, on: l.lastPaymentOn ?? (l.repaidAt ? isoToLocalDate(l.repaidAt) : null) }));
  const withDates = settledDates.filter((x): x is { loan: Loan; on: string } => x.on !== null);
  const onTime = withDates.filter((x) => x.on <= x.loan.dueDate).length;
  const durations = withDates.map((x) => Math.max(0, daysBetween(isoToLocalDate(x.loan.createdAt), x.on)));

  const thisMonth = `${today.slice(0, 7)}-01`;
  const months: MonthBar[] = Array.from({ length: 6 }, (_, i) => {
    const key = addMonths(thisMonth, i - 5).slice(0, 7);
    return { key, label: MONTH[Number(key.slice(5, 7)) - 1]!, lentMinor: 0, collectedMinor: 0 };
  });
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const l of loans) {
    const m = byKey.get(isoToLocalDate(l.createdAt).slice(0, 7));
    if (m) m.lentMinor += l.amountMinor;
  }
  for (const a of activity) {
    if (a.type !== "payment") continue;
    const m = byKey.get(a.date.slice(0, 7));
    if (m) m.collectedMinor += a.amountMinor;
  }

  const aging: AgingBucket[] = [
    { label: "1–7 days", minor: 0, count: 0 },
    { label: "8–30 days", minor: 0, count: 0 },
    { label: "30+ days", minor: 0, count: 0 },
  ];
  for (const l of loans) {
    if (l.status !== "overdue") continue;
    const late = -(l.daysUntilDue ?? 0);
    const b = aging[late <= 7 ? 0 : late <= 30 ? 1 : 2]!;
    b.minor += l.remainingMinor;
    b.count += 1;
  }

  const open = loans.filter((l) => l.status !== "repaid");
  return {
    collectionRate: lent > 0 ? paid / lent : 0,
    onTimeRate: withDates.length > 0 ? onTime / withDates.length : null,
    avgDaysToSettle: durations.length > 0 ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : null,
    months,
    aging,
    topOwed: groupByPerson(loans).filter((p) => p.owedMinor > 0).slice(0, 5),
    largestOpen: open.length ? open.reduce((a, b) => (b.remainingMinor > a.remainingMinor ? b : a)) : null,
    settledCount: settled.length,
  };
}
