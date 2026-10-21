import { daysBetween } from './dates';
import type { LoanStatus } from './types';

/** A loan due within this many days (inclusive of today) is "due soon". */
export const DUE_SOON_DAYS = 3;

/**
 * Status is derived, never stored: "overdue" depends on today's date, so a stored value would go stale at midnight.
 * `today` is the user's calendar date supplied by the caller (the API passes the server-computed value).
 */
export function deriveStatus(dueDate: string, repaidAt: string | null, today: string): LoanStatus {
  if (repaidAt !== null) return 'repaid';
  const days = daysBetween(today, dueDate);
  if (days < 0) return 'overdue'; // due today is NOT overdue
  if (days <= DUE_SOON_DAYS) return 'due_soon';
  return 'pending';
}

/** Whole days until the due date: negative when overdue, 0 when due today, null once repaid. */
export function daysUntilDue(dueDate: string, repaidAt: string | null, today: string): number | null {
  if (repaidAt !== null) return null;
  return daysBetween(today, dueDate);
}
