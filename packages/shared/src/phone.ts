// "max" metadata validates real numbering plans (e.g. Indian mobiles must start 6-9); the default build only checks length.
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

const DEFAULT_REGION = 'IN';

/**
 * Normalizes user input to E.164 ("+919876543210"). Numbers without a "+" are read as Indian.
 * Returns null unless it is a valid *mobile* number: an OTP has to be deliverable by SMS, and
 * Indian landline area codes (e.g. 5876...) are otherwise valid numbers.
 * Some regions (e.g. the US) can't tell mobile from landline and report FIXED_LINE_OR_MOBILE.
 */
export function normalizePhone(input: string): string | null {
  const parsed = parsePhoneNumberFromString(input.trim(), DEFAULT_REGION);
  if (!parsed || !parsed.isValid()) return null;
  const type = parsed.getType();
  if (type !== 'MOBILE' && type !== 'FIXED_LINE_OR_MOBILE') return null;
  return parsed.number;
}

/** "+919876543210" -> "+91 98765 43210". Falls back to the raw value if it can't be parsed. */
export function formatPhoneForDisplay(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}
