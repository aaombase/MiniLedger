export type LoanStatus = "pending" | "due_soon" | "overdue" | "repaid";
export type LoanFilter = "all" | "outstanding" | "overdue" | "repaid";

export interface User { id: string; phone: string; timezone: string }

export interface Loan {
  id: string;
  friendName: string;
  amountMinor: number;
  currency: "INR";
  dueDate: string;
  note: string | null;
  status: LoanStatus;
  daysUntilDue: number | null;
  repaidAt: string | null;
  hasReceipt: boolean;
  createdAt: string;
  paidMinor: number;
  remainingMinor: number;
  lastPaymentOn: string | null;
}

export interface Payment { id: string; amountMinor: number; paidOn: string; note: string | null; hasReceipt: boolean; createdAt: string }
export interface LoanDetail extends Loan { payments: Payment[] }

export interface RecordPaymentInput { amountMinor: number; paidOn?: string; note?: string | null }
export interface UpdateLoanInput { friendName?: string; dueDate?: string; note?: string | null }

export interface ActivityItem {
  id: string;
  type: "loan_created" | "payment";
  loanId: string;
  friendName: string;
  amountMinor: number;
  date: string;
  at: string;
  settled: boolean;
}

export interface Summary {
  asOf: string;
  currency: "INR";
  totalLentMinor: number;
  totalRepaidMinor: number;
  outstandingMinor: number;
  overdueMinor: number;
  counts: { total: number; outstanding: number; overdue: number; dueSoon: number; partial: number; repaid: number };
}

export interface CreateLoanInput { friendName: string; amountMinor: number; dueDate: string; note?: string | null }

export interface OtpRequestResult { expiresInSeconds: number; resendAfterSeconds: number }
export interface VerifyResult { token: string; expiresAt: string; user: User }
export interface LoansResponse { asOf: string; loans: Loan[] }

export interface PickedImage { uri: string; name: string; type: "image/jpeg" | "image/png" | "image/webp"; size: number }
export interface ImageSourceSpec { uri: string; headers?: Record<string, string> }
