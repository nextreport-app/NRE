/** Strip everything except digits — used for validation and wa.me links. */
export function whatsappDigitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** True when the user typed an explicit international prefix (+ or 00). */
export function hasExplicitCountryPrefix(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.startsWith("+") || trimmed.startsWith("00");
}

/**
 * UK mobiles are often entered as 07… locally (11 digits with a leading 0).
 * WhatsApp/wa.me expects 44 without the trunk 0.
 */
export function isUkLocalMobileDigits(digits: string): boolean {
  return digits.length === 11 && digits.startsWith("07");
}

/**
 * Normalize to wa.me digits (country code + national number, no + or leading 0).
 * Supports India (+91), US/Canada (+1), UK (+44), and any other E.164 input.
 */
export function normalizeWhatsAppDigits(raw: string): string {
  const trimmed = raw.trim();
  let digits = whatsappDigitsOnly(trimmed);

  if (trimmed.startsWith("00") && digits.length > 2) {
    digits = digits.slice(2);
  }

  if (isUkLocalMobileDigits(digits)) {
    return `44${digits.slice(1)}`;
  }

  // +1…, +44…, +91…, or pasted full international without punctuation.
  if (hasExplicitCountryPrefix(trimmed) || digits.length >= 11) {
    return digits;
  }

  return digits;
}

/** Click-to-chat URL for a prospect's WhatsApp number. */
export function buildWhatsAppChatUrl(raw: string): string {
  return `https://wa.me/${normalizeWhatsAppDigits(raw)}`;
}

/** Human-readable line for admin notification emails. */
export function formatWhatsAppForNotification(raw: string): { display: string; chatUrl: string } {
  const digits = normalizeWhatsAppDigits(raw);
  const display = raw.trim().startsWith("+") ? raw.trim() : `+${digits}`;
  return { display, chatUrl: `https://wa.me/${digits}` };
}
