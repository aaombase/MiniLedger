import { z } from "zod";
import { addDays, isValidDateString } from "./dates";
import { hasTooManyDecimals, MAX_PAISE, MIN_PAISE, parseRupeesToPaise } from "./money";
import { normalizeIndianMobile } from "./phone";

export const MSG = {
  name: "Enter your friend's name",
  amount: "Enter an amount between ₹1 and ₹10,00,000",
  decimals: "Use at most 2 decimal places",
  dueDate: "Choose a due date",
  dueRange: "Choose a date within 5 years of today",
  note: "Keep the note under 200 characters",
  phone: "Enter a valid 10-digit mobile number",
};

export const phoneFormSchema = z.object({
  phone: z.string().refine((v) => normalizeIndianMobile(v) !== null, MSG.phone),
});

export const otpSchema = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") });

const dueDateRule = (today: string) =>
  z
    .string({ required_error: MSG.dueDate })
    .refine(isValidDateString, MSG.dueDate)
    .refine((d) => d >= addDays(today, -365 * 5 - 1) && d <= addDays(today, 365 * 5 + 1), MSG.dueRange);

/** Client form schema: amount is the raw string the user typed. */
export function createLoanFormSchema(today: string) {
  return z.object({
    friendName: z.string().transform((s) => s.trim()).pipe(z.string().min(1, MSG.name).max(60, MSG.name)),
    amount: z.string().superRefine((v, ctx) => {
      if (hasTooManyDecimals(v)) ctx.addIssue({ code: "custom", message: MSG.decimals });
      else if (parseRupeesToPaise(v) === null) ctx.addIssue({ code: "custom", message: MSG.amount });
    }),
    dueDate: z.string().nullable().refine((v) => v !== null, MSG.dueDate).pipe(dueDateRule(today)),
    note: z.string().max(200, MSG.note),
  });
}
export type CreateLoanFormValues = { friendName: string; amount: string; dueDate: string | null; note: string };

/** Server-side input schema (used by the mock API). */
export function createLoanInputSchema(today: string) {
  return z.object({
    friendName: z.string().transform((s) => s.trim()).pipe(z.string().min(1, MSG.name).max(60, MSG.name)),
    amountMinor: z.number({ required_error: MSG.amount }).int(MSG.amount).min(MIN_PAISE, MSG.amount).max(MAX_PAISE, MSG.amount),
    dueDate: dueDateRule(today),
    note: z.string().max(200, MSG.note).nullish(),
  });
}
