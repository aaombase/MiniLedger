/** Money is always handled as integer paise (1 rupee = 100 paise). Never as floats. */
export const MIN_AMOUNT_MINOR = 100; // ₹1.00
export const MAX_AMOUNT_MINOR = 100_000_000; // ₹10,00,000.00

// Up to 7 whole digits, optional 1-2 decimal digits. Grouping commas are stripped first.
const RUPEE_PATTERN = /^\d{1,7}(\.\d{1,2})?$/;

/**
 * Parses a rupee string the user typed ("1,500.5") into integer paise (150050).
 * Works on the string directly - `parseFloat(x) * 100` gives 100.49999... for "1.005".
 * Returns null when the text is malformed or outside the allowed loan range.
 */
export function parseRupeesToPaise(input: string): number | null {
  const cleaned = input.trim().replace(/,/g, '');
  if (!RUPEE_PATTERN.test(cleaned)) return null;

  const [whole = '0', fraction = ''] = cleaned.split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));

  if (paise < MIN_AMOUNT_MINOR || paise > MAX_AMOUNT_MINOR) return null;
  return paise;
}

const wholeRupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const withPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats paise with Indian digit grouping: 12345650 -> "₹1,23,456.50"; whole rupees drop ".00". */
export function formatINR(paise: number): string {
  if (paise % 100 === 0) return wholeRupees.format(paise / 100);
  return withPaise.format(paise / 100);
}
