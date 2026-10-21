import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { File, Paths } from "expo-file-system";
import { getApiClient } from "./client";
import type { CreateLoanInput, LoanFilter, PickedImage, RecordPaymentInput, UpdateLoanInput } from "@/shared/types";

const api = () => getApiClient();

export const qk = {
  summary: ["summary"] as const,
  loans: (f: LoanFilter) => ["loans", f] as const,
  loan: (id: string) => ["loan", id] as const,
  activity: (limit: number) => ["activity", limit] as const,
};

function invalidateLedger(qc: QueryClient, id?: string) {
  void qc.invalidateQueries({ queryKey: ["summary"] });
  void qc.invalidateQueries({ queryKey: ["loans"] });
  void qc.invalidateQueries({ queryKey: ["activity"] });
  if (id) {
    void qc.invalidateQueries({ queryKey: ["loan", id] });
    void qc.invalidateQueries({ queryKey: ["receipt", id] });
  }
}

export const useSummary = () => useQuery({ queryKey: qk.summary, queryFn: () => api().getSummary() });
export const useLoans = (filter: LoanFilter = "all") => useQuery({ queryKey: qk.loans(filter), queryFn: () => api().listLoans(filter) });
export const useLoan = (id: string) => useQuery({ queryKey: qk.loan(id), queryFn: () => api().getLoan(id) });
export const useActivity = (limit = 100) => useQuery({ queryKey: qk.activity(limit), queryFn: () => api().getActivity(limit) });

export const useRequestOtp = () => useMutation({ mutationFn: (phone: string) => api().requestOtp(phone) });
export const useVerifyOtp = () =>
  useMutation({ mutationFn: (v: { phone: string; code: string; timezone: string }) => api().verifyOtp(v.phone, v.code, v.timezone) });

export function useCreateLoan() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: CreateLoanInput) => api().createLoan(input), onSuccess: (l) => invalidateLedger(qc, l.id) });
}
export function useRepayLoan() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api().repayLoan(id), onSettled: (_d, _e, id) => invalidateLedger(qc, id) });
}
export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; input: RecordPaymentInput }) => api().recordPayment(v.id, v.input),
    onSettled: (_d, _e, v) => invalidateLedger(qc, v.id),
  });
}
export function useUpdateLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; input: UpdateLoanInput }) => api().updateLoan(v.id, v.input),
    onSuccess: (_d, v) => invalidateLedger(qc, v.id),
  });
}
export function useDeleteLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api().deleteLoan(id),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: ["loan", id] });
      invalidateLedger(qc);
    },
  });
}
export function useUploadReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; image: PickedImage }) => api().uploadReceipt(v.id, v.image),
    onSuccess: (_l, v) => invalidateLedger(qc, v.id),
  });
}
export function useRemoveReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api().removeReceipt(id),
    onSuccess: (_l, id) => {
      qc.removeQueries({ queryKey: ["receipt", id] });
      invalidateLedger(qc, id);
    },
  });
}
export const useLogout = () => useMutation({ mutationFn: () => api().logout() });

/**
 * React Native's <Image> doesn't reliably send auth headers on Android, so the receipt is downloaded with the
 * session token into the cache and shown from there.
 */
export function useReceiptUri(id: string, hasReceipt: boolean) {
  return useQuery({
    queryKey: ["receipt", id],
    enabled: hasReceipt,
    staleTime: Infinity,
    queryFn: async () => {
      const { uri, headers } = api().receiptSource(id);
      const dest = new File(Paths.cache, `receipt-${id}-${Date.now()}.img`);
      const file = await File.downloadFileAsync(uri, dest, { headers, idempotent: true });
      return file.uri;
    },
  });
}
