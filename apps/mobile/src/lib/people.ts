import type { Loan, LoanStatus } from "@/shared/types";

export interface Person {
  key: string;
  name: string;
  loans: Loan[];
  lentMinor: number;
  paidMinor: number;
  owedMinor: number;
  overdueMinor: number;
  openCount: number;
  /** The most urgent state among this person's open loans, or "repaid" when everything is settled. */
  status: LoanStatus;
}

const RANK: Record<LoanStatus, number> = { overdue: 0, due_soon: 1, pending: 2, repaid: 3 };

/** Names typed by hand vary in case and spacing; "rohan  mehta" and "Rohan Mehta" are the same friend. */
export const personKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

export function groupByPerson(loans: Loan[]): Person[] {
  const map = new Map<string, Person>();
  const newestFirst = [...loans].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const loan of newestFirst) {
    const key = personKey(loan.friendName);
    let p = map.get(key);
    if (!p) {
      p = { key, name: loan.friendName.trim(), loans: [], lentMinor: 0, paidMinor: 0, owedMinor: 0, overdueMinor: 0, openCount: 0, status: "repaid" };
      map.set(key, p);
    }
    p.loans.push(loan);
    p.lentMinor += loan.amountMinor;
    p.paidMinor += loan.paidMinor;
    if (loan.status !== "repaid") {
      p.owedMinor += loan.remainingMinor;
      p.openCount += 1;
      if (loan.status === "overdue") p.overdueMinor += loan.remainingMinor;
      if (RANK[loan.status] < RANK[p.status]) p.status = loan.status;
    }
  }
  return [...map.values()].sort((a, b) => b.owedMinor - a.owedMinor || a.name.localeCompare(b.name));
}
