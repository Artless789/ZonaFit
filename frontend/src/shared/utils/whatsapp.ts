/**
 * Reusable WhatsApp utility for Merwil ZonaFit WhatsApp Web / wa.me integration.
 */

/**
 * Normalizes a phone number to international E.164 without leading '+'
 * Handles Colombian numbers: prepends '57' if 10 digits starting with 3.
 */
export function normalizeWhatsAppPhone(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s\-()+]+/g, '').trim();
  if (!cleaned) return '';

  // Colombian mobile numbers: starts with 3 and 10 digits long -> prepend 57
  if (cleaned.startsWith('3') && cleaned.length === 10) {
    return `57${cleaned}`;
  }

  // Already prefixed with 57 and 12 digits long
  if (cleaned.startsWith('57') && cleaned.length === 12) {
    return cleaned;
  }

  return cleaned;
}

/**
 * Returns true if the phone number consists of 8 to 15 digits.
 */
export function isValidWhatsAppPhone(phone: string): boolean {
  const normalized = normalizeWhatsAppPhone(phone);
  return /^\d{8,15}$/.test(normalized);
}

/**
 * Constructs the standard wa.me URL with properly encoded message.
 */
export function buildWaLink(phone: string, message: string): string {
  const normalized = normalizeWhatsAppPhone(phone);
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${normalized}?text=${encodedMessage}`;
}

/**
 * Safely opens a WhatsApp URL in a new window/tab using noopener,noreferrer.
 */
export function openWhatsAppLink(url: string): void {
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}
