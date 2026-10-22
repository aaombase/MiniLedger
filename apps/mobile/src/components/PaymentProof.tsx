import {
  usePaymentReceiptUri,
  useReceiptUri,
  useRemovePaymentReceipt,
  useRemoveReceipt,
  useUploadPaymentReceipt,
  useUploadReceipt,
} from "@/api/queries";
import type { Payment } from "@/shared/types";
import { ProofControl } from "./ProofControl";

/** Proof of one payment (e.g. the UPI screenshot of that instalment). */
export function PaymentProof({ loanId, payment }: { loanId: string; payment: Payment }) {
  const photo = usePaymentReceiptUri(loanId, payment.id, payment.hasReceipt);
  const upload = useUploadPaymentReceipt();
  const remove = useRemovePaymentReceipt();
  return (
    <ProofControl
      noun="proof of payment"
      addLabel="Add proof"
      hasPhoto={payment.hasReceipt}
      photoUri={photo.data}
      photoFailed={photo.isError}
      onRetry={() => void photo.refetch()}
      onUpload={(image) => upload.mutateAsync({ loanId, paymentId: payment.id, image })}
      onRemove={() => remove.mutateAsync({ loanId, paymentId: payment.id })}
    />
  );
}

/** The loan's own receipt: the bill or UPI screenshot of the money that was lent. */
export function LoanProof({ loanId, hasReceipt }: { loanId: string; hasReceipt: boolean }) {
  const photo = useReceiptUri(loanId, hasReceipt);
  const upload = useUploadReceipt();
  const remove = useRemoveReceipt();
  return (
    <ProofControl
      noun="receipt"
      addLabel="Add receipt"
      hasPhoto={hasReceipt}
      photoUri={photo.data}
      photoFailed={photo.isError}
      onRetry={() => void photo.refetch()}
      onUpload={(image) => upload.mutateAsync({ id: loanId, image })}
      onRemove={() => remove.mutateAsync(loanId)}
    />
  );
}
