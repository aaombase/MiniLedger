/** '98765 43210' → '+919876543210'; null when not a valid Indian mobile. */
export function normalizeIndianMobile(digits: string): string | null {
  let d = digits.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : null;
}

/** '+919876543210' → '+91 98765 43210' */
export function formatPhoneForDisplay(e164: string): string {
  const d = e164.replace(/^\+91/, "");
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}

/** Group up to 10 typed digits as '98765 43210'. */
export function groupPhoneDigits(input: string): string {
  const d = input.replace(/\D/g, "").slice(0, 10);
  return d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d;
}
