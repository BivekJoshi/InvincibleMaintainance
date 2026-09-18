/**
 * A WhatsApp chat link for a Nepali mobile number, or null for a landline (WhatsApp
 * needs a mobile). Accepts the forms staff type: `98…`, `+977 98…`, `977-98…`.
 *
 * @param {string} [phone]
 * @returns {string|null}
 */
export function whatsappHref(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '').replace(/^977/, '');
  return /^9[678]\d{8}$/.test(digits) ? `https://wa.me/977${digits}` : null;
}
