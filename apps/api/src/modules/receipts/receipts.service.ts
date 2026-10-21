import { randomUUID } from 'node:crypto';
import type { Loan } from '@miniledger/shared';
import { and, eq } from 'drizzle-orm';
import { fileTypeFromBuffer } from 'file-type';
import type { Db } from '../../db/client';
import { loans } from '../../db/schema';
import type { Clock } from '../../lib/clock';
import { AppError, errors } from '../../lib/errors';
import type { AuthUser } from '../auth/auth.service';
import { findOwnedLoan, type LoansService } from '../loans/loans.service';
import type { ReceiptStorage } from './receipt-storage';

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

  async function attach(user: AuthUser, loanId: string, data: Buffer): Promise<Loan> {
    const loan = await findOwnedLoan(db, user.id, loanId);
    if (!loan) throw errors.loanNotFound();
    if (data.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', { file: 'The file is empty' });
    }

    // Trust the bytes, never the client's Content-Type or file name.
    const detected = await fileTypeFromBuffer(data);
    const extension = detected ? ALLOWED[detected.mime] : undefined;
    if (!detected || !extension) {
      throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Only JPG, PNG or WebP images are supported.');
    }

    const key = `${loan.id}-${randomUUID()}.${extension}`;
    await storage.save(key, data);

    try {
      await db
        .update(loans)
        .set({ receiptKey: key, receiptMime: detected.mime, receiptBytes: data.length, updatedAt: clock.now() })
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

  return { assertOwned, attach, read, detach };
}

const receiptNotFound = () => new AppError(404, 'RECEIPT_NOT_FOUND', 'This loan has no receipt.');

export type ReceiptsService = ReturnType<typeof createReceiptsService>;
