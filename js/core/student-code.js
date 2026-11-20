/* Short sign-in codes: 8 characters, no look-alikes (no 0 O 1 I), shown as K7M2-QX9R. */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE = /^[2-9A-HJ-NP-Z]{8}$/;

/** A new random code, without the dash. */
export function newCode() {
  const bytes = new Uint8Array(8);
  try { crypto.getRandomValues(bytes); }
  catch { for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256); }
  return Array.from(bytes, (b) => ALPHABET[b & 31]).join('');
}

/** Show a code in two groups of four. Older long IDs are shown as they are. @param {string} id */
export function showCode(id) {
  return CODE.test(id) ? id.slice(0, 4) + '-' + id.slice(4) : id;
}

/** Accept what people type or paste: any case, spaces or a dash. Older IDs pass through unchanged. @param {string} raw */
export function cleanCode(raw) {
  const text = raw.trim();
  const upper = text.replace(/[\s-]/g, '').toUpperCase();
  return CODE.test(upper) ? upper : text;
}
