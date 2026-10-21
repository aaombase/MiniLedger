import { z } from 'zod';
import { daysBetween, isRealDate, isValidTimeZone } from './dates';
import { MAX_AMOUNT_MINOR, MIN_AMOUNT_MINOR } from './money';
import { normalizePhone } from './phone';

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
/** Due dates must fall within roughly 5 years either side of today (catches typos like the year 2206). */
export const MAX_DUE_DATE_RANGE_DAYS = 1826;

const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/;

const phoneSchema = z.string().transform((value, ctx) => {
  const normalized = normalizePhone(value);
  if (!normalized) {
    ctx.addIssue({ code: 'custom', message: 'Enter a valid 10-digit mobile number' });
    return z.NEVER;
  }
  return normalized;
});

export const requestOtpSchema = z.object({ phone: phoneSchema });

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^[0-9]{6}$/, 'Enter the 6-digit code'),
  // The device reports its timezone; anything that is not a real IANA zone quietly falls back to the default.
  timezone: z
    .string()
    .optional()
    .transform((tz) => (tz && isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE)),
});

export const loanFilterSchema = z.enum(['all', 'outstanding', 'overdue', 'repaid']).default('all');

export const listLoansQuerySchema = z.object({ status: loanFilterSchema });

const friendNameSchema = z
  .string()
  .refine((value) => !CONTROL_CHARS.test(value), 'Name contains invalid characters')
  .transform((value) => value.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(1, "Enter your friend's name").max(60, 'Name must be 60 characters or fewer'));

const amountMinorSchema = z
  .number('Enter an amount')
  .int('Amount must be a whole number of paise')
  .min(MIN_AMOUNT_MINOR, 'Enter an amount of at least ₹1')
  .max(MAX_AMOUNT_MINOR, 'Amount can be at most ₹10,00,000');

const noteSchema = z
  .string()
  .nullish()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  })
  .refine((value) => value === null || value.length <= 200, 'Note must be 200 characters or fewer');

/**
 * `today` is the user's calendar date. It is a parameter because the allowed due-date window is relative to it,
 * and the server (not the device clock) is the authority on what "today" is.
 */
export function createLoanSchema(today: string) {
  return z.object({
    friendName: friendNameSchema,
    amountMinor: amountMinorSchema,
    dueDate: dueDateSchema(today),
    note: noteSchema,
  });
}

const dueDateSchema = (today: string) =>
  z
    .string()
    .refine(isRealDate, 'Choose a valid due date')
    .refine(
      (value) => !isRealDate(value) || Math.abs(daysBetween(today, value)) <= MAX_DUE_DATE_RANGE_DAYS,
      'Due date must be within 5 years of today',
    );

/** Editable fields only. Amount and repayment state are deliberately absent, so they can't be changed this way. */
export function updateLoanSchema(today: string) {
  return z.object({
    friendName: friendNameSchema.optional(),
    dueDate: dueDateSchema(today).optional(),
    note: noteSchema.optional(),
  });
}

/** A payment can be back-dated (e.g. "he paid me last week") but never dated in the future. */
export function recordPaymentSchema(today: string) {
  return z.object({
    amountMinor: amountMinorSchema,
    paidOn: z
      .string()
      .refine(isRealDate, 'Choose a valid payment date')
      .refine((value) => !isRealDate(value) || value <= today, "Payment date can't be in the future")
      .refine(
        (value) => !isRealDate(value) || daysBetween(value, today) <= MAX_DUE_DATE_RANGE_DAYS,
        'Payment date must be within 5 years of today',
      )
      .optional(),
    note: noteSchema,
  });
}

export const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

/** Flattens zod issues into `{ field: firstMessage }` - the shape of `error.details` in API responses. */
export function zodIssuesToDetails(error: z.ZodError): Record<string, string> {
  const details: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in details)) details[key] = issue.message;
  }
  return details;
}
