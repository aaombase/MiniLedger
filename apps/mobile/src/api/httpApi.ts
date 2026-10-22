import { File as FsFile } from "expo-file-system";
import type { ApiClient } from "./client";
import { ApiError } from "./ApiError";
import type { CreateLoanInput, Loan, LoanDetail, LoanFilter, LoansResponse, PickedImage, RecordPaymentInput, UpdateLoanInput } from "@/shared/types";

const TIMEOUT_MS = 10_000;

const paymentReceiptPath = (loanId: string, paymentId: string) =>
  `/v1/loans/${encodeURIComponent(loanId)}/payments/${encodeURIComponent(paymentId)}/receipt`;

export function createHttpApi(baseUrl: string): ApiClient {
  let token: string | null = null;

  async function call<T>(method: string, path: string, body?: unknown, isForm = false): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    // For multipart the runtime must set the Content-Type itself (it adds the boundary).
    if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch {
      // Offline, wrong IP, firewall, or the 10 s timeout.
      throw new ApiError(0, "NETWORK_ERROR", "Couldn't reach the server");
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 204) return undefined as T;
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const err = json?.error ?? {};
      throw new ApiError(res.status, err.code ?? "UNKNOWN", err.message ?? "Request failed", err.details);
    }
    return json as T;
  }

  return {
    setToken(t) { token = t; },
    requestOtp: (phone) => call("POST", "/v1/auth/otp/request", { phone }),
    verifyOtp: (phone, code, timezone) => call("POST", "/v1/auth/otp/verify", { phone, code, timezone }),
    logout: () => call("POST", "/v1/auth/logout"),
    me: () => call("GET", "/v1/me"),
    listLoans: (filter: LoanFilter) => call<LoansResponse>("GET", `/v1/loans?status=${filter}`),
    createLoan: (input: CreateLoanInput) => call<Loan>("POST", "/v1/loans", input),
    getLoan: (id) => call("GET", `/v1/loans/${encodeURIComponent(id)}`),
    repayLoan: (id) => call("POST", `/v1/loans/${encodeURIComponent(id)}/repay`),
    recordPayment: (id, input: RecordPaymentInput) => call("POST", `/v1/loans/${encodeURIComponent(id)}/payments`, input),
    updateLoan: (id, input: UpdateLoanInput) => call("PATCH", `/v1/loans/${encodeURIComponent(id)}`, input),
    deleteLoan: (id) => call("DELETE", `/v1/loans/${encodeURIComponent(id)}`),
    getActivity: (limit) => call("GET", `/v1/activity?limit=${limit}`),
    getSummary: () => call("GET", "/v1/summary"),
    async uploadReceipt(id: string, image: PickedImage) {
      const form = new FormData();
      // Expo's fetch rejects React Native's { uri } FormData parts; a file-system File is a Blob it can stream.
      form.append("file", new FsFile(image.uri) as unknown as Blob, image.name);
      return call<Loan>("PUT", `/v1/loans/${encodeURIComponent(id)}/receipt`, form, true);
    },
    async uploadPaymentReceipt(loanId: string, paymentId: string, image: PickedImage) {
      const form = new FormData();
      form.append("file", new FsFile(image.uri) as unknown as Blob, image.name);
      return call<LoanDetail>("PUT", paymentReceiptPath(loanId, paymentId), form, true);
    },
    removePaymentReceipt: (loanId, paymentId) => call("DELETE", paymentReceiptPath(loanId, paymentId)),
    paymentReceiptSource: (loanId, paymentId) => ({
      uri: `${baseUrl}${paymentReceiptPath(loanId, paymentId)}`,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
    removeReceipt: (id) => call("DELETE", `/v1/loans/${encodeURIComponent(id)}/receipt`),
    receiptSource: (id) => ({
      uri: `${baseUrl}/v1/loans/${encodeURIComponent(id)}/receipt`,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
  };
}
