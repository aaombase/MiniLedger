import { describe, expect, it } from 'vitest';
import { DUE_SOON_DAYS, daysUntilDue, deriveStatus } from './status';

const TODAY = '2026-10-21';

describe('deriveStatus', () => {
  it('is overdue when due before today', () => {
    expect(deriveStatus('2026-10-20', null, TODAY)).toBe('overdue');
    expect(deriveStatus('2020-01-01', null, TODAY)).toBe('overdue');
  });

  it('is NOT overdue when due today - it is due soon', () => {
    expect(deriveStatus('2026-10-21', null, TODAY)).toBe('due_soon');
  });

  it('is due soon through today + 3 days inclusive', () => {
    expect(deriveStatus('2026-10-22', null, TODAY)).toBe('due_soon');
    expect(deriveStatus('2026-10-24', null, TODAY)).toBe('due_soon');
  });

  it('is pending from today + 4 days onward', () => {
    expect(DUE_SOON_DAYS).toBe(3);
    expect(deriveStatus('2026-10-25', null, TODAY)).toBe('pending');
    expect(deriveStatus('2027-10-21', null, TODAY)).toBe('pending');
  });

  it('is repaid whenever repaidAt is set, even if the due date has passed', () => {
    expect(deriveStatus('2026-10-01', '2026-10-15T08:00:00.000Z', TODAY)).toBe('repaid');
    expect(deriveStatus('2026-12-01', '2026-10-15T08:00:00.000Z', TODAY)).toBe('repaid');
  });
});

describe('daysUntilDue', () => {
  it('is negative when overdue, zero when due today, positive when upcoming', () => {
    expect(daysUntilDue('2026-10-16', null, TODAY)).toBe(-5);
    expect(daysUntilDue('2026-10-21', null, TODAY)).toBe(0);
    expect(daysUntilDue('2026-11-05', null, TODAY)).toBe(15);
  });

  it('is null for repaid loans', () => {
    expect(daysUntilDue('2026-10-16', '2026-10-17T00:00:00.000Z', TODAY)).toBeNull();
  });
});
