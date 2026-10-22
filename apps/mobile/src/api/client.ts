import type {
  ActivityItem, CreateLoanInput, ImageSourceSpec, Loan, LoanDetail, LoanFilter, LoansResponse, OtpRequestResult, PickedImage,
  RecordPaymentInput, Summary, UpdateLoanInput, User, VerifyResult,
} from "@/shared/types";
import { ApiError } from "./ApiError";
import { createHttpApi } from "./httpApi";

export interface ApiClient {
  setToken(token: string | null): void;
  requestOtp(phone: string): Promise<OtpRequestResult>;
  verifyOtp(phone: string, code: string, timezone: string): Promise<VerifyResult>;
  logout(): Promise<void>;
  me(): Promise<User>;
  listLoans(filter: LoanFilter): Promise<LoansResponse>;
  createLoan(input: CreateLoanInput): Promise<Loan>;
  getLoan(id: string): Promise<LoanDetail>;
  repayLoan(id: string): Promise<LoanDetail>;
  recordPayment(id: string, input: RecordPaymentInput): Promise<LoanDetail>;
  updateLoan(id: string, input: UpdateLoanInput): Promise<LoanDetail>;
  deleteLoan(id: string): Promise<void>;
  getActivity(limit: number): Promise<{ items: ActivityItem[] }>;
  getSummary(): Promise<Summary>;
  uploadReceipt(id: string, image: PickedImage): Promise<Loan>;
  removeReceipt(id: string): Promise<LoanDetail>;
  uploadPaymentReceipt(loanId: string, paymentId: string, image: PickedImage): Promise<LoanDetail>;
  removePaymentReceipt(loanId: string, paymentId: string): Promise<LoanDetail>;
  paymentReceiptSource(loanId: string, paymentId: string): ImageSourceSpec;
  receiptSource(id: string): ImageSourceSpec;
}

// The ONLY place the API URL is read. It must be the dev machine's LAN address (e.g. http://192.168.1.20:4000),
// because "localhost" on a phone is the phone itself.
const API_URL: string | undefined = process.env.EXPO_PUBLIC_API_URL;

let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  unauthorizedHandler = fn;
}

/** Any 401 from an authenticated call means the session is gone: let the auth layer sign the user out. */
function withAuthGuard(inner: ApiClient): ApiClient {
  const skip = new Set(["requestOtp", "verifyOtp", "logout", "setToken", "receiptSource", "paymentReceiptSource"]);
  return new Proxy(inner, {
    get(target, prop: string) {
      const v = (target as unknown as Record<string, unknown>)[prop];
      if (typeof v !== "function" || skip.has(prop)) return typeof v === "function" ? v.bind(target) : v;
      return async (...args: unknown[]) => {
        try {
          return await (v as (...a: unknown[]) => Promise<unknown>).apply(target, args);
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) unauthorizedHandler?.();
          throw e;
        }
      };
    },
  });
}

let client: ApiClient | null = null;
export function getApiClient(): ApiClient {
  if (!client) {
    if (!API_URL) {
      throw new Error("EXPO_PUBLIC_API_URL is not set. Copy apps/mobile/.env.example to apps/mobile/.env and set your LAN IP.");
    }
    client = withAuthGuard(createHttpApi(API_URL.replace(/\/+$/, "")));
  }
  return client;
}
