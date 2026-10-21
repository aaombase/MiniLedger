import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import {
  DEFAULT_TIMEZONE,
  MAX_DUE_DATE_RANGE_DAYS,
  createLoanSchema,
  loanFilterSchema,
  requestOtpSchema,
  verifyOtpSchema,
  zodIssuesToDetails,
} from './schemas';

const TODAY = '2026-10-21';
const schema = createLoanSchema(TODAY);
const valid = { friendName: 'Rohan', amountMinor: 150050, dueDate: '2026-11-05' };

describe('createLoanSchema', () => {
  it('accepts a valid loan and defaults note to null', () => {
    expect(schema.parse(valid)).toEqual({ ...valid, note: null });
  });

  it('trims and collapses whitespace in the friend name', () => {
    expect(schema.parse({ ...valid, friendName: '  Rohan   Mehta ' }).friendName).toBe('Rohan Mehta');
  });

  it('accepts non-Latin names', () => {
    expect(schema.parse({ ...valid, friendName: 'रोहन मेहता' }).friendName).toBe('रोहन मेहता');
  });

  it.each(['', '   ', 'a'.repeat(61), 'Ro\u0000han', 'Ro\nhan'])('rejects friend name %j', (friendName) => {
    expect(schema.safeParse({ ...valid, friendName }).success).toBe(false);
  });

  it('accepts a 60 character name', () => {
    expect(schema.safeParse({ ...valid, friendName: 'a'.repeat(60) }).success).toBe(true);
  });

  it.each([0, 99, -100, 100_000_001, 1500.5, Number.NaN, '1500', null])('rejects amountMinor %j', (amountMinor) => {
    expect(schema.safeParse({ ...valid, amountMinor }).success).toBe(false);
  });

  it('accepts the amount bounds', () => {
    expect(schema.safeParse({ ...valid, amountMinor: 100 }).success).toBe(true);
    expect(schema.safeParse({ ...valid, amountMinor: 100_000_000 }).success).toBe(true);
  });

  it.each(['2026-02-30', '2026-13-01', '05-11-2026', '2026-11-5', 'tomorrow', ''])('rejects due date %j', (dueDate) => {
    expect(schema.safeParse({ ...valid, dueDate }).success).toBe(false);
  });

  it('allows past due dates (the loan will simply be overdue)', () => {
    expect(schema.safeParse({ ...valid, dueDate: '2026-10-01' }).success).toBe(true);
  });

  it('limits the due date to about 5 years either side of today', () => {
    expect(MAX_DUE_DATE_RANGE_DAYS).toBe(1826);
    expect(schema.safeParse({ ...valid, dueDate: addDays(TODAY, 1826) }).success).toBe(true);
    expect(schema.safeParse({ ...valid, dueDate: addDays(TODAY, 1827) }).success).toBe(false);
    expect(schema.safeParse({ ...valid, dueDate: addDays(TODAY, -1826) }).success).toBe(true);
    expect(schema.safeParse({ ...valid, dueDate: addDays(TODAY, -1827) }).success).toBe(false);
  });

  it('turns a blank note into null and trims a real one', () => {
    expect(schema.parse({ ...valid, note: '   ' }).note).toBeNull();
    expect(schema.parse({ ...valid, note: '  Concert tickets ' }).note).toBe('Concert tickets');
  });

  it('rejects a note over 200 characters', () => {
    expect(schema.safeParse({ ...valid, note: 'n'.repeat(201) }).success).toBe(false);
    expect(schema.safeParse({ ...valid, note: 'n'.repeat(200) }).success).toBe(true);
  });

  it('strips unknown fields', () => {
    const parsed = schema.parse({ ...valid, repaidAt: '2026-01-01', userId: 'x' });
    expect(parsed).not.toHaveProperty('repaidAt');
    expect(parsed).not.toHaveProperty('userId');
  });
});

describe('requestOtpSchema', () => {
  it('normalizes the phone number', () => {
    expect(requestOtpSchema.parse({ phone: '98765 43210' })).toEqual({ phone: '+919876543210' });
  });

  it('reports an invalid phone on the phone field', () => {
    const result = requestOtpSchema.safeParse({ phone: '12345' });
    expect(result.success).toBe(false);
    if (!result.success) expect(zodIssuesToDetails(result.error)).toHaveProperty('phone');
  });
});

describe('verifyOtpSchema', () => {
  const base = { phone: '9876543210', code: '482913' };

  it('accepts a 6 digit code and normalizes the phone', () => {
    expect(verifyOtpSchema.parse(base)).toEqual({ phone: '+919876543210', code: '482913', timezone: DEFAULT_TIMEZONE });
  });

  it.each(['12345', '1234567', 'abcdef', '12 345', '', '１２３４５６'])('rejects code %j', (code) => {
    expect(verifyOtpSchema.safeParse({ ...base, code }).success).toBe(false);
  });

  it('keeps a valid IANA timezone and falls back to the default for junk', () => {
    expect(verifyOtpSchema.parse({ ...base, timezone: 'America/New_York' }).timezone).toBe('America/New_York');
    expect(verifyOtpSchema.parse({ ...base, timezone: 'Mars/Olympus' }).timezone).toBe(DEFAULT_TIMEZONE);
  });
});

describe('loanFilterSchema', () => {
  it('defaults to all and accepts the known filters', () => {
    expect(loanFilterSchema.parse(undefined)).toBe('all');
    expect(loanFilterSchema.parse('overdue')).toBe('overdue');
  });

  it('rejects unknown filters', () => {
    expect(loanFilterSchema.safeParse('pending').success).toBe(false);
  });
});

describe('zodIssuesToDetails', () => {
  it('maps each failing field to its first message', () => {
    const result = schema.safeParse({ friendName: '', amountMinor: 5, dueDate: 'nope' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const details = zodIssuesToDetails(result.error);
      expect(Object.keys(details).sort()).toEqual(['amountMinor', 'dueDate', 'friendName']);
      expect(typeof details.friendName).toBe('string');
    }
  });
});
