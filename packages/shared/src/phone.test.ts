import { describe, expect, it } from 'vitest';
import { formatPhoneForDisplay, normalizePhone } from './phone';

describe('normalizePhone', () => {
  it.each([
    '9876543210',
    '98765 43210',
    '+91 98765 43210',
    '+919876543210',
    '09876543210',
    '91-98765-43210',
    '(+91) 98765-43210',
  ])('normalizes %j to E.164', (input) => {
    expect(normalizePhone(input)).toBe('+919876543210');
  });

  it('accepts other countries when a + prefix is given', () => {
    expect(normalizePhone('+1 415 555 2671')).toBe('+14155552671');
    expect(normalizePhone('+44 7911 123456')).toBe('+447911123456');
  });

  it.each(['', 'abc', '12345', '5876543210', '98765432', '98765432101', '+91 12345 67890', '+999 123'])(
    'rejects %j',
    (input) => {
      expect(normalizePhone(input)).toBeNull();
    },
  );
});

describe('formatPhoneForDisplay', () => {
  it('formats Indian numbers as +91 XXXXX XXXXX', () => {
    expect(formatPhoneForDisplay('+919876543210')).toBe('+91 98765 43210');
  });

  it('formats other regions in international style', () => {
    expect(formatPhoneForDisplay('+14155552671')).toBe('+1 415 555 2671');
  });
});
