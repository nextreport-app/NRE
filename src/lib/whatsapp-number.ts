/** Strip everything except digits — used for validation and wa.me links. */
export function whatsappDigitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Normalize to wa.me digits. Ten-digit Indian mobiles (6–9 prefix) get +91
 * prepended; numbers that already include a country code are left as-is.
 */
export function normalizeWhatsAppDigits(raw: string): string {
  let digits = whatsappDigitsOnly(raw);
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    digits = `91${digits}`;
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
