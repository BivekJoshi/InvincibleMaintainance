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

/**
 * A WhatsApp share of a message (Phase L4 — the quotation link): a chat with the customer's mobile when it is one,
 * otherwise WhatsApp's own "send to" picker.
 *
 * @param {string|undefined} phone
 * @param {string} text
 */
export function whatsappShareHref(phone, text) {
  return `${whatsappHref(phone) ?? 'https://wa.me/'}?text=${encodeURIComponent(text)}`;
}

/** A Viber share of a message: Viber's forward screen, where the person picks the chat. */
export const viberShareHref = (text) => `viber://forward?text=${encodeURIComponent(text)}`;
