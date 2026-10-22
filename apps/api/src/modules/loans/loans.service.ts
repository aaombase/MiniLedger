import {
  DUE_SOON_DAYS,
  addDays,
  daysUntilDue,
  deriveStatus,
  todayIn,
  type ActivityItem,
  type Loan,
  type LoanDetail,
  type LoanFilter,
  type LoanStatus,
  type Payment,
  type Summary,
} from '@miniledger/shared';
import { and, desc, eq, getTableColumns, isNotNull, isNull, lt, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { loans, payments, type LoanRow, type PaymentRow } from '../../db/schema';
import type { Clock } from '../../lib/clock';
import { AppError, errors } from '../../lib/errors';
import type { ReceiptStorage } from '../receipts/receipt-storage';
import type { AuthUser } from '../auth/auth.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Order of the list: most urgent first.
const STATUS_RANK: Record<LoanStatus, number> = { overdue: 0, due_soon: 1, pending: 2, repaid: 3 };

export interface NewLoan {
  friendName: string;
  amountMinor: number;
  dueDate: string;
  note: string | null;
}

export interface LoanChanges {
  friendName?: string;
  dueDate?: string;
  note?: string | null;
}

export interface NewPayment {
  amountMinor: number;
  paidOn?: string;
  note: string | null;
}

/**
 * The single place that answers "is this loan mine?". Every query is scoped by the caller's id, so a loan that
 * belongs to someone else is indistinguishable from one that doesn't exist (both are null -> 404).
 */
export async function findOwnedLoan(db: Db, userId: string, id: string): Promise<LoanRow | null> {
  if (!UUID.test(id)) return null;
  const [row] = await db
    .select()
    .from(loans)
    .where(and(eq(loans.id, id), eq(loans.userId, userId)))
    .limit(1);
  return row ?? null;
}

// A repaid loan counts as fully paid even if it has no payment rows (e.g. repaid before payments were recorded).
// Columns are written fully qualified: Drizzle renders `${loans.id}` as a bare "id" in single-table queries, which
// inside these subqueries would silently bind to payments.id instead.
const paidExpr = sql<number>`CASE WHEN "loans"."repaid_at" IS NOT NULL THEN "loans"."amount_minor"
  ELSE COALESCE((SELECT SUM(p.amount_minor) FROM payments p WHERE p.loan_id = "loans"."id"), 0) END`.mapWith(Number);
const lastPaymentExpr = sql<string | null>`(SELECT MAX(p.paid_on)::text FROM payments p WHERE p.loan_id = "loans"."id")`;

type LoanWithPaid = LoanRow & { paidMinor: number; lastPaymentOn: string | null };

const amountExceedsBalance = (remainingMinor: number) =>
  new AppError(422, 'AMOUNT_EXCEEDS_BALANCE', 'That is more than the amount still owed.', { remainingMinor });

export function createLoansService({ db, clock, storage }: { db: Db; clock: Clock; storage?: ReceiptStorage }) {
  /** The user's calendar date, computed once per request so every figure in a response shares one "today". */
  const todayFor = (user: AuthUser): string => todayIn(user.timezone, clock.now());

  function toLoan(row: LoanWithPaid, today: string): Loan {
    const repaidAt = row.repaidAt ? row.repaidAt.toISOString() : null;
    return {
      id: row.id,
      friendName: row.friendName,
      amountMinor: row.amountMinor,
      currency: 'INR',
      dueDate: row.dueDate,
      note: row.note,
      status: deriveStatus(row.dueDate, repaidAt, today),
      daysUntilDue: daysUntilDue(row.dueDate, repaidAt, today),
      repaidAt,
      hasReceipt: row.receiptKey !== null,
      createdAt: row.createdAt.toISOString(),
      paidMinor: row.paidMinor,
      remainingMinor: row.amountMinor - row.paidMinor,
      lastPaymentOn: row.lastPaymentOn,
    };
  }

  const toPayment = (p: PaymentRow): Payment => ({
    id: p.id,
    amountMinor: p.amountMinor,
    paidOn: p.paidOn,
    note: p.note,
    hasReceipt: p.receiptKey !== null,
    createdAt: p.createdAt.toISOString(),
  });

  async function selectLoans(executor: Db, where: SQL | undefined): Promise<LoanWithPaid[]> {
    return executor
      .select({ ...getTableColumns(loans), paidMinor: paidExpr, lastPaymentOn: lastPaymentExpr })
      .from(loans)
      .where(where);
  }

  async function loadDetail(executor: Db, user: AuthUser, id: string): Promise<LoanDetail> {
    const [row] = await selectLoans(executor, and(eq(loans.id, id), eq(loans.userId, user.id)));
    if (!row) throw errors.loanNotFound();
    const history = await executor
      .select()
      .from(payments)
      .where(eq(payments.loanId, id))
      .orderBy(desc(payments.createdAt), desc(payments.paidOn));
    return { ...toLoan(row, todayFor(user)), payments: history.map(toPayment) };
  }

  async function create(user: AuthUser, input: NewLoan): Promise<Loan> {
    const now = clock.now();
    const [row] = await db
      .insert(loans)
      .values({ ...input, userId: user.id, createdAt: now, updatedAt: now })
      .returning();
    return toLoan({ ...row!, paidMinor: 0, lastPaymentOn: null }, todayFor(user));
  }

  async function list(user: AuthUser, filter: LoanFilter): Promise<{ asOf: string; loans: Loan[] }> {
    const today = todayFor(user);
    const conditions = [eq(loans.userId, user.id)];
    if (filter === 'outstanding') conditions.push(isNull(loans.repaidAt));
    if (filter === 'repaid') conditions.push(isNotNull(loans.repaidAt));
    if (filter === 'overdue') conditions.push(isNull(loans.repaidAt), lt(loans.dueDate, today));

    const result = (await selectLoans(db, and(...conditions))).map((row) => toLoan(row, today));
    result.sort((a, b) => {
      if (a.status !== b.status && STATUS_RANK[a.status] !== STATUS_RANK[b.status]) {
        return STATUS_RANK[a.status] - STATUS_RANK[b.status];
      }
      if (a.status === 'repaid') return (b.repaidAt ?? '').localeCompare(a.repaidAt ?? ''); // latest repayment first
      return a.dueDate.localeCompare(b.dueDate) || a.createdAt.localeCompare(b.createdAt);
    });
    return { asOf: today, loans: result };
  }

  async function get(user: AuthUser, id: string): Promise<LoanDetail> {
    if (!UUID.test(id)) throw errors.loanNotFound();
    return loadDetail(db, user, id);
  }

  async function update(user: AuthUser, id: string, changes: LoanChanges): Promise<LoanDetail> {
    if (!UUID.test(id)) throw errors.loanNotFound();
    const set = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
    const [updated] = await db
      .update(loans)
      .set({ ...set, updatedAt: clock.now() })
      .where(and(eq(loans.id, id), eq(loans.userId, user.id)))
      .returning({ id: loans.id });
    if (!updated) throw errors.loanNotFound();
    return loadDetail(db, user, id);
  }

  async function remove(user: AuthUser, id: string): Promise<void> {
    if (!UUID.test(id)) throw errors.loanNotFound();
    const paymentFiles = await db
      .select({ key: payments.receiptKey })
      .from(payments)
      .innerJoin(loans, eq(loans.id, payments.loanId))
      .where(and(eq(payments.loanId, id), eq(loans.userId, user.id), isNotNull(payments.receiptKey)));
    const [deleted] = await db
      .delete(loans)
      .where(and(eq(loans.id, id), eq(loans.userId, user.id)))
      .returning({ receiptKey: loans.receiptKey });
    if (!deleted) throw errors.loanNotFound();
    // The rows are gone either way; a leftover file is harmless, so a storage hiccup must not fail the request.
    const keys = [deleted.receiptKey, ...paymentFiles.map((f) => f.key)].filter((k): k is string => k !== null);
    if (storage) await Promise.all(keys.map((key) => storage.remove(key).catch(() => {})));
  }

  /**
   * Locks the loan row for the rest of the transaction, so concurrent payments on one loan run one at a time and
   * the balance check below always sees every earlier payment.
   */
  async function applyPayment(
    user: AuthUser,
    id: string,
    amountFor: (remainingMinor: number) => number,
    paidOn: string | undefined,
    note: string | null,
  ): Promise<LoanDetail> {
    if (!UUID.test(id)) throw errors.loanNotFound();
    return db.transaction(async (tx) => {
      const [loan] = await tx
        .select()
        .from(loans)
        .where(and(eq(loans.id, id), eq(loans.userId, user.id)))
        .for('update');
      if (!loan) throw errors.loanNotFound();
      if (loan.repaidAt) throw errors.loanAlreadyRepaid();

      const [{ paid }] = (await tx
        .select({ paid: sql<number>`COALESCE(SUM(${payments.amountMinor}), 0)`.mapWith(Number) })
        .from(payments)
        .where(eq(payments.loanId, id))) as [{ paid: number }];
      const remaining = loan.amountMinor - paid;
      const amount = amountFor(remaining);
      if (amount > remaining) throw amountExceedsBalance(remaining);

      const now = clock.now();
      await tx.insert(payments).values({ loanId: id, amountMinor: amount, paidOn: paidOn ?? todayFor(user), note, createdAt: now });
      if (amount === remaining) {
        await tx.update(loans).set({ repaidAt: now, updatedAt: now }).where(eq(loans.id, id));
      }
      return loadDetail(tx as unknown as Db, user, id);
    });
  }

  const recordPayment = (user: AuthUser, id: string, input: NewPayment) =>
    applyPayment(user, id, () => input.amountMinor, input.paidOn, input.note);

  /** Settles whatever is still owed. */
  const repay = (user: AuthUser, id: string) => applyPayment(user, id, (remaining) => remaining, undefined, null);

  /** All figures come from a single statement, so they describe one consistent snapshot of the ledger. */
  async function summary(user: AuthUser): Promise<Summary> {
    const today = todayFor(user);
    const dueSoonEnd = addDays(today, DUE_SOON_DAYS);
    const result = await db.execute(sql`
      WITH l AS (
        SELECT
          loans.amount_minor,
          loans.due_date,
          loans.repaid_at,
          CASE WHEN loans.repaid_at IS NOT NULL THEN loans.amount_minor
               ELSE COALESCE((SELECT SUM(p.amount_minor) FROM payments p WHERE p.loan_id = loans.id), 0) END AS paid
        FROM loans
        WHERE loans.user_id = ${user.id}
      )
      SELECT
        COALESCE(SUM(amount_minor), 0)::bigint AS total_lent,
        COALESCE(SUM(paid), 0)::bigint AS total_repaid,
        COALESCE(SUM(amount_minor - paid) FILTER (WHERE repaid_at IS NULL AND due_date < ${today}::date), 0)::bigint AS overdue,
        COUNT(*)::bigint AS total_count,
        COUNT(*) FILTER (WHERE repaid_at IS NULL)::bigint AS outstanding_count,
        COUNT(*) FILTER (WHERE repaid_at IS NULL AND due_date < ${today}::date)::bigint AS overdue_count,
        COUNT(*) FILTER (
          WHERE repaid_at IS NULL AND due_date >= ${today}::date AND due_date <= ${dueSoonEnd}::date
        )::bigint AS due_soon_count,
        COUNT(*) FILTER (WHERE repaid_at IS NULL AND paid > 0)::bigint AS partial_count,
        COUNT(*) FILTER (WHERE repaid_at IS NOT NULL)::bigint AS repaid_count
      FROM l
    `);
    const r = result.rows[0] as Record<string, number | string>;
    const n = (key: string) => Number(r[key]);

    const totalLentMinor = n('total_lent');
    const totalRepaidMinor = n('total_repaid');
    return {
      asOf: today,
      currency: 'INR',
      totalLentMinor,
      totalRepaidMinor,
      outstandingMinor: totalLentMinor - totalRepaidMinor,
      overdueMinor: n('overdue'),
      counts: {
        total: n('total_count'),
        outstanding: n('outstanding_count'),
        overdue: n('overdue_count'),
        dueSoon: n('due_soon_count'),
        partial: n('partial_count'),
        repaid: n('repaid_count'),
      },
    };
  }

  /** Loans lent and payments received, newest first. */
  async function activity(user: AuthUser, limit: number): Promise<{ items: ActivityItem[] }> {
    const result = await db.execute(sql`
      SELECT * FROM (
        SELECT 'loan_created' AS type, l.id::text AS id, l.id::text AS loan_id, l.friend_name, l.amount_minor,
               l.created_at AS at, NULL::text AS paid_on, false AS settled
        FROM loans l WHERE l.user_id = ${user.id}
        UNION ALL
        SELECT 'payment', p.id::text, l.id::text, l.friend_name, p.amount_minor,
               p.created_at, p.paid_on::text,
               (l.repaid_at IS NOT NULL AND p.created_at = l.repaid_at)
        FROM payments p JOIN loans l ON l.id = p.loan_id WHERE l.user_id = ${user.id}
      ) e
      ORDER BY e.at DESC, e.type DESC
      LIMIT ${limit}
    `);
    const items = (result.rows as Record<string, unknown>[]).map((r): ActivityItem => {
      const at = new Date(r.at as string | Date);
      return {
        id: r.id as string,
        type: r.type as ActivityItem['type'],
        loanId: r.loan_id as string,
        friendName: r.friend_name as string,
        amountMinor: Number(r.amount_minor),
        date: (r.paid_on as string | null) ?? todayIn(user.timezone, at),
        at: at.toISOString(),
        settled: Boolean(r.settled),
      };
    });
    return { items };
  }

  return { todayFor, create, list, get, update, remove, recordPayment, repay, summary, activity };
}

export type LoansService = ReturnType<typeof createLoansService>;
