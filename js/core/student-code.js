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

/** A sign-in link that fills the code in on another device. @param {string} id */
export function signInLink(id) {
  return location.origin + location.pathname + '#id=' + encodeURIComponent(id);
}

/** Read and remove a code from the address (#id=CODE or ?id=CODE). */
export function takeLinkedCode() {
  const match = /(?:^#|[#&])id=([^&]*)/.exec(location.hash) || /[?&]id=([^&#]*)/.exec(location.search);
  if (!match) return '';
  let code = '';
  try { code = cleanCode(decodeURIComponent(match[1])); } catch { return ''; }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(code)) return '';
  try {
    const search = location.search.replace(/([?&])id=[^&]*&?/, '$1').replace(/[?&]$/, '');
    const hash = location.hash.replace(/(^#|&)id=[^&]*/, '$1').replace(/^#&/, '#').replace(/&$/, '').replace(/^#$/, '');
    history.replaceState(null, '', location.pathname + search + hash);
  } catch {}
  return code;
}
