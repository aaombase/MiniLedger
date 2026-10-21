export const MIN_PAISE = 100;
export const MAX_PAISE = 100_000_000;

/** "1,500.50" → 150050. Never uses parseFloat. Returns null when invalid or out of range. */
export function parseRupeesToPaise(input: string): number | null {
  const s = input.replace(/[\s,]/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const paise = parseInt(whole, 10) * 100 + parseInt((frac + "00").slice(0, 2), 10);
  if (paise < MIN_PAISE || paise > MAX_PAISE) return null;
  return paise;
}

/** True when the input has more than 2 decimal places (for a specific error message). */
export function hasTooManyDecimals(input: string): boolean {
  return /^\d+\.\d{3,}$/.test(input.replace(/[\s,]/g, ""));
}

function groupIndian(whole: string): string {
  if (whole.length <= 3) return whole;
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

/** 12345650 → "₹1,23,456.50"; 150000 → "₹1,500"; 0 → "₹0". Integer-only math. */
export function formatINR(paise: number): string {
  const neg = paise < 0;
  const abs = Math.abs(Math.round(paise));
  const whole = String(Math.floor(abs / 100));
  const frac = abs % 100;
  const body = groupIndian(whole) + (frac === 0 ? "" : "." + String(frac).padStart(2, "0"));
  return `${neg ? "-" : ""}₹${body}`;
}

/** Group a raw rupee string for display in inputs: "1500.5" → "1,500.5". */
export function formatRupeeInput(raw: string): string {
  const s = raw.replace(/[\s,]/g, "");
  if (!/^\d+(\.\d*)?$/.test(s)) return raw;
  const [whole, frac] = s.split(".");
  const w = groupIndian(String(parseInt(whole, 10)));
  return frac === undefined ? w : `${w}.${frac}`;
}

/** "2,500 rupees" for accessibility labels. */
export function spokenINR(paise: number): string {
  return `${formatINR(paise).replace("₹", "")} rupees`;
}
