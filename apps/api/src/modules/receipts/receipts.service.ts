import { randomUUID } from 'node:crypto';
import type { Loan, LoanDetail } from '@miniledger/shared';
import { and, eq } from 'drizzle-orm';
import { fileTypeFromBuffer } from 'file-type';
import type { Db } from '../../db/client';
import { loans, payments, type PaymentRow } from '../../db/schema';
import type { Clock } from '../../lib/clock';
import { AppError, errors } from '../../lib/errors';
import type { AuthUser } from '../auth/auth.service';
import { findOwnedLoan, type LoansService } from '../loans/loans.service';
import type { ReceiptStorage } from './receipt-storage';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

// Allow-list of what a receipt may be, keyed by the type detected from the file's own bytes.
const ALLOWED: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

interface Deps {
  db: Db;
  clock: Clock;
  storage: ReceiptStorage;
  loans: LoansService;
}

export function createReceiptsService({ db, clock, storage, loans: loansService }: Deps) {
  /** Cheap ownership check, run *before* the upload body is read, so strangers can't make us buffer megabytes. */
  async function assertOwned(user: AuthUser, loanId: string): Promise<void> {
    if (!(await findOwnedLoan(db, user.id, loanId))) throw errors.loanNotFound();
  }

  /** Checks the bytes really are an allowed image, then saves them under a server-generated key. */
  async function store(ownerId: string, data: Buffer): Promise<{ key: string; mime: string }> {
    // Trust the bytes, never the client's Content-Type or file name.
    const detected = await fileTypeFromBuffer(data);
    const extension = detected ? ALLOWED[detected.mime] : undefined;
    if (!detected || !extension) {
      throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Only JPG, PNG or WebP images are supported.');
    }
    const key = `${ownerId}-${randomUUID()}.${extension}`;
    await storage.save(key, data);
    return { key, mime: detected.mime };
  }

  async function findOwnedPayment(user: AuthUser, loanId: string, paymentId: string): Promise<PaymentRow | null> {
    if (!UUID.test(loanId) || !UUID.test(paymentId)) return null;
    const [row] = await db
      .select({ payment: payments })
      .from(payments)
      .innerJoin(loans, eq(loans.id, payments.loanId))
      .where(and(eq(payments.id, paymentId), eq(payments.loanId, loanId), eq(loans.userId, user.id)))
      .limit(1);
    return row?.payment ?? null;
  }

  async function assertPaymentOwned(user: AuthUser, loanId: string, paymentId: string): Promise<void> {
    if (!(await findOwnedPayment(user, loanId, paymentId))) throw errors.loanNotFound();
  }

  async function attachToPayment(user: AuthUser, loanId: string, paymentId: string, data: Buffer): Promise<LoanDetail> {
    const payment = await findOwnedPayment(user, loanId, paymentId);
    if (!payment) throw errors.loanNotFound();
    if (data.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', { file: 'The file is empty' });
    }
    const { key, mime } = await store(payment.id, data);
    try {
      await db
        .update(payments)
        .set({ receiptKey: key, receiptMime: mime, receiptBytes: data.length })
        .where(eq(payments.id, payment.id));
    } catch (err) {
      await storage.remove(key);
      throw err;
    }
    if (payment.receiptKey) await storage.remove(payment.receiptKey).catch(() => {});
    return loansService.get(user, loanId);
  }

  async function detachFromPayment(user: AuthUser, loanId: string, paymentId: string): Promise<LoanDetail> {
    const payment = await findOwnedPayment(user, loanId, paymentId);
    if (!payment) throw errors.loanNotFound();
    if (!payment.receiptKey) throw receiptNotFound();
    await db
      .update(payments)
      .set({ receiptKey: null, receiptMime: null, receiptBytes: null })
      .where(eq(payments.id, payment.id));
    await storage.remove(payment.receiptKey).catch(() => {});
    return loansService.get(user, loanId);
  }

  async function readPaymentReceipt(
    user: AuthUser,
    loanId: string,
    paymentId: string,
  ): Promise<{ data: Buffer; mime: string }> {
    const payment = await findOwnedPayment(user, loanId, paymentId);
    if (!payment) throw errors.loanNotFound();
    if (!payment.receiptKey || !payment.receiptMime) throw receiptNotFound();
    const data = await storage.read(payment.receiptKey);
    if (!data) throw receiptNotFound();
    return { data, mime: payment.receiptMime };
  }

  async function attach(user: AuthUser, loanId: string, data: Buffer): Promise<Loan> {
    const loan = await findOwnedLoan(db, user.id, loanId);
    if (!loan) throw errors.loanNotFound();
    if (data.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', { file: 'The file is empty' });
    }

    const { key, mime } = await store(loan.id, data);

    try {
      await db
        .update(loans)
        .set({ receiptKey: key, receiptMime: mime, receiptBytes: data.length, updatedAt: clock.now() })
        .where(and(eq(loans.id, loan.id), eq(loans.userId, user.id)));
    } catch (err) {
      await storage.remove(key); // don't leave an orphan behind if the database write failed
      throw err;
    }

    // Replace, don't accumulate: drop the previous file only after the new one is safely recorded.
    if (loan.receiptKey) await storage.remove(loan.receiptKey).catch(() => {});

    return loansService.get(user, loan.id);
  }

  async function read(user: AuthUser, loanId: string): Promise<{ data: Buffer; mime: string }> {
    const loan = await findOwnedLoan(db, user.id, loanId);
    if (!loan) throw errors.loanNotFound();
    if (!loan.receiptKey || !loan.receiptMime) throw receiptNotFound();

    const data = await storage.read(loan.receiptKey);
    if (!data) throw receiptNotFound();
    return { data, mime: loan.receiptMime };
  }

  async function detach(user: AuthUser, loanId: string): Promise<Loan> {
    const loan = await findOwnedLoan(db, user.id, loanId);
    if (!loan) throw errors.loanNotFound();
    if (!loan.receiptKey) throw receiptNotFound();
    await db
      .update(loans)
      .set({ receiptKey: null, receiptMime: null, receiptBytes: null, updatedAt: clock.now() })
      .where(and(eq(loans.id, loan.id), eq(loans.userId, user.id)));
    // The row no longer points at the file, so a failed delete only leaves a harmless orphan.
    await storage.remove(loan.receiptKey).catch(() => {});
    return loansService.get(user, loan.id);
  }

  return {
    assertOwned,
    attach,
    read,
    detach,
    assertPaymentOwned,
    attachToPayment,
    detachFromPayment,
    readPaymentReceipt,
  };
}

const receiptNotFound = () => new AppError(404, 'RECEIPT_NOT_FOUND', 'This loan has no receipt.');

export type ReceiptsService = ReturnType<typeof createReceiptsService>;
