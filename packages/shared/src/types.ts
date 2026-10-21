export type LoanStatus = 'pending' | 'due_soon' | 'overdue' | 'repaid';
export type LoanFilter = 'all' | 'outstanding' | 'overdue' | 'repaid';

export interface User {
  id: string;
  phone: string;
  timezone: string;
}

export interface Loan {
  id: string;
  friendName: string;
  amountMinor: number;
  currency: 'INR';
  dueDate: string; // 'YYYY-MM-DD'
  note: string | null;
  status: LoanStatus;
  daysUntilDue: number | null; // negative when overdue, null when repaid
  repaidAt: string | null; // ISO timestamp
  hasReceipt: boolean;
  createdAt: string; // ISO timestamp
  paidMinor: number; // sum of payments received so far
  remainingMinor: number; // amountMinor - paidMinor
  lastPaymentOn: string | null; // 'YYYY-MM-DD'
}

export interface Payment {
  id: string;
  amountMinor: number;
  paidOn: string; // 'YYYY-MM-DD'
  note: string | null;
  createdAt: string; // ISO timestamp
}

/** A single loan as returned by the detail, payment and repay endpoints: includes its payment history. */
export interface LoanDetail extends Loan {
  payments: Payment[]; // newest first
}

export interface RecordPaymentInput {
  amountMinor: number;
  paidOn?: string;
  note?: string | null;
}

export interface UpdateLoanInput {
  friendName?: string;
  dueDate?: string;
  note?: string | null;
}

export type ActivityType = 'loan_created' | 'payment';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  loanId: string;
  friendName: string;
  amountMinor: number;
  date: string; // 'YYYY-MM-DD' in the user's timezone
  at: string; // ISO timestamp the event was recorded
  settled: boolean; // a payment that closed the loan
}

export interface ActivityResponse {
  items: ActivityItem[];
}

export interface Summary {
  asOf: string; // 'YYYY-MM-DD' in the user's timezone
  currency: 'INR';
  totalLentMinor: number;
  totalRepaidMinor: number;
  outstandingMinor: number;
  overdueMinor: number;
  counts: {
    total: number;
    outstanding: number;
    overdue: number;
    dueSoon: number;
    partial: number; // open loans with at least one payment
    repaid: number;
  };
}

export interface CreateLoanInput {
  friendName: string;
  amountMinor: number;
  dueDate: string;
  note?: string | null;
}

export interface LoanListResponse {
  asOf: string;
  loans: Loan[];
}

export interface OtpRequestResponse {
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

export interface VerifyOtpResponse {
  token: string;
  expiresAt: string;
  user: User;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}
