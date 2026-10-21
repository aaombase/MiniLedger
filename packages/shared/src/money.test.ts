import { describe, expect, it } from 'vitest';
import { MAX_AMOUNT_MINOR, MIN_AMOUNT_MINOR, formatINR, parseRupeesToPaise } from './money';

describe('parseRupeesToPaise', () => {
  it('parses whole rupees', () => {
    expect(parseRupeesToPaise('1500')).toBe(150000);
  });

  it('parses grouping commas and one decimal digit', () => {
    expect(parseRupeesToPaise('1,500.5')).toBe(150050);
  });

  it('parses two decimal digits', () => {
    expect(parseRupeesToPaise('1500.05')).toBe(150005);
  });

  it('trims surrounding whitespace', () => {
    expect(parseRupeesToPaise('  250  ')).toBe(25000);
  });

  it('avoids floating point error (1.15 rupees is exactly 115 paise)', () => {
    expect(parseRupeesToPaise('1.15')).toBe(115);
    expect(parseRupeesToPaise('1.1')).toBe(110);
  });

  it('accepts the minimum and maximum', () => {
    expect(parseRupeesToPaise('1')).toBe(MIN_AMOUNT_MINOR);
    expect(parseRupeesToPaise('1000000')).toBe(MAX_AMOUNT_MINOR);
  });

  it.each([
    '',
    '   ',
    'abc',
    '1e3',
    '-5',
    '+5',
    '0',
    '0.99',
    '1.005',
    '1.',
    '.5',
    '1..5',
    '10000000.01',
    '1,00,00,000',
    '12345678',
  ])('rejects %j', (input) => {
    expect(parseRupeesToPaise(input)).toBeNull();
  });
});

describe('formatINR', () => {
  it('groups digits the Indian way', () => {
    expect(formatINR(12345650)).toBe('₹1,23,456.50');
  });

  it('hides .00 for whole rupees', () => {
    expect(formatINR(150000)).toBe('₹1,500');
  });

  it('keeps two decimals when there are paise', () => {
    expect(formatINR(150005)).toBe('₹1,500.05');
    expect(formatINR(150050)).toBe('₹1,500.50');
  });

  it('formats zero', () => {
    expect(formatINR(0)).toBe('₹0');
  });

  it('formats the maximum loan', () => {
    expect(formatINR(MAX_AMOUNT_MINOR)).toBe('₹10,00,000');
  });
});
