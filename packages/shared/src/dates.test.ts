import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, formatDate, formatShortDate, isRealDate, isValidTimeZone, todayIn } from './dates';

describe('todayIn', () => {
  // 2026-10-21 18:45 UTC is already 22 Oct 00:15 in Kolkata (UTC+5:30) but still 21 Oct 14:45 in New York (UTC-4).
  const instant = new Date('2026-10-21T18:45:00Z');

  it('uses the wall-clock date of the given timezone', () => {
    expect(todayIn('Asia/Kolkata', instant)).toBe('2026-10-22');
    expect(todayIn('America/New_York', instant)).toBe('2026-10-21');
    expect(todayIn('UTC', instant)).toBe('2026-10-21');
  });

  it('returns a zero padded YYYY-MM-DD string', () => {
    expect(todayIn('UTC', new Date('2026-01-05T00:00:00Z'))).toBe('2026-01-05');
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA names and rejects junk', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});

describe('isRealDate', () => {
  it('accepts real calendar dates', () => {
    expect(isRealDate('2026-02-28')).toBe(true);
    expect(isRealDate('2028-02-29')).toBe(true);
  });

  it('rejects impossible or malformed dates', () => {
    expect(isRealDate('2026-02-30')).toBe(false);
    expect(isRealDate('2027-02-29')).toBe(false);
    expect(isRealDate('2026-13-01')).toBe(false);
    expect(isRealDate('2026-1-5')).toBe(false);
    expect(isRealDate('26-01-05')).toBe(false);
    expect(isRealDate('not a date')).toBe(false);
  });
});

describe('addDays / daysBetween', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-21', 3)).toBe('2026-10-24');
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts whole days, signed', () => {
    expect(daysBetween('2026-10-21', '2026-10-24')).toBe(3);
    expect(daysBetween('2026-10-24', '2026-10-21')).toBe(-3);
    expect(daysBetween('2026-10-21', '2026-10-21')).toBe(0);
  });

  it('is not affected by daylight saving transitions', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
  });
});

describe('formatDate', () => {
  it('formats without timezone shifting', () => {
    expect(formatDate('2026-11-04')).toBe('4 Nov 2026');
    expect(formatDate('2026-01-01')).toBe('1 Jan 2026');
    expect(formatShortDate('2026-11-04')).toBe('4 Nov');
  });
});
