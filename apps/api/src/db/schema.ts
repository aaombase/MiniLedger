import { sql } from 'drizzle-orm';
import { bigint, char, check, date, index, integer, pgTable, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phoneE164: text('phone_e164').notNull().unique(),
    timezone: text('timezone').notNull().default('Asia/Kolkata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('users_phone_e164_check', sql`${t.phoneE164} ~ '^\\+[1-9][0-9]{6,14}$'`)],
);

export const otpChallenges = pgTable(
  'otp_challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phoneE164: text('phone_e164').notNull(),
    // HMAC-SHA256(phone:code, OTP_SECRET). The plaintext code is never stored.
    codeHash: text('code_hash').notNull(),
    attempts: smallint('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    // Set once on success, or when the challenge is superseded / locked after too many guesses.
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('otp_challenges_attempts_check', sql`${t.attempts} BETWEEN 0 AND 5`),
    index('otp_challenges_phone_created_idx').on(t.phoneE164, t.createdAt.desc()),
  ],
);

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // SHA-256 of the random bearer token. The token itself is only ever returned to the client once.
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const loans = pgTable(
  'loans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    friendName: text('friend_name').notNull(),
    // Integer paise. Never floats for money.
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 }).notNull().default('INR'),
    // Calendar date with no timezone, transported as 'YYYY-MM-DD'.
    dueDate: date('due_date', { mode: 'string' }).notNull(),
    note: text('note'),
    // The only persisted repayment fact. "Overdue" etc. are derived from it plus today's date.
    repaidAt: timestamp('repaid_at', { withTimezone: true }),
    receiptKey: text('receipt_key'),
    receiptMime: text('receipt_mime'),
    receiptBytes: integer('receipt_bytes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('loans_friend_name_check', sql`char_length(${t.friendName}) BETWEEN 1 AND 60`),
    check('loans_amount_minor_check', sql`${t.amountMinor} BETWEEN 100 AND 100000000`),
    check('loans_currency_check', sql`${t.currency} = 'INR'`),
    check('loans_note_check', sql`${t.note} IS NULL OR char_length(${t.note}) <= 200`),
    check(
      'loans_receipt_mime_check',
      sql`${t.receiptMime} IS NULL OR ${t.receiptMime} IN ('image/jpeg','image/png','image/webp')`,
    ),
    check(
      'loans_receipt_bytes_check',
      sql`${t.receiptBytes} IS NULL OR ${t.receiptBytes} BETWEEN 1 AND 5242880`,
    ),
    index('loans_user_due_idx')
      .on(t.userId, t.dueDate)
      .where(sql`${t.repaidAt} IS NULL`),
    index('loans_user_created_idx').on(t.userId, t.createdAt.desc()),
  ],
);

/** Money received against a loan. A loan is repaid exactly when its payments add up to its amount. */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => loans.id, { onDelete: 'cascade' }),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    paidOn: date('paid_on', { mode: 'string' }).notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('payments_amount_minor_check', sql`${t.amountMinor} BETWEEN 1 AND 100000000`),
    check('payments_note_check', sql`${t.note} IS NULL OR char_length(${t.note}) <= 200`),
    index('payments_loan_created_idx').on(t.loanId, t.createdAt.desc()),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type LoanRow = typeof loans.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;
