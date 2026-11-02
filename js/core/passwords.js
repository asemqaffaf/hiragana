import {
  canStore, readPasswordVerifier, readSyncSecret, writePasswordVerifier, writePendingPassword, writeSyncSecret,
} from './storage.js';
/** Password gates still work for a temporary guest when browser storage is blocked. @type {Map<string, string>} */
const temporaryVerifiers = new Map();

/** @param {ArrayBuffer} bytes */
const hex = (bytes) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
/** Student IDs provide a distinct public salt for each account, including on another device.
 * The derived value is a bearer credential; it is sent only in HTTPS POST bodies.
 * @param {string} id @param {string} password
 */
export async function passwordSecret(id, password) {
  if (!password || password.length > 256) throw new Error('password');
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({
    name: 'PBKDF2', hash: 'SHA-256', iterations: 310000,
    salt: encoder.encode('hiragana14-password-v1:' + id),
  }, material, 256));
}
/** @param {string} secret */
async function verifierFor(secret) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('hiragana14-local:' + secret)));
}
/** @param {string} id */
export const hasPassword = (id) => typeof readPasswordVerifier(id) === 'string' || temporaryVerifiers.has(id);
/** @param {string} id @param {string} password */
export async function verifyPassword(id, password) {
  const secret = await passwordSecret(id, password);
  return (readPasswordVerifier(id) || temporaryVerifiers.get(id)) === await verifierFor(secret);
}
/** Accept a credential only after a cloud login has verified it. @param {string} id @param {string} secret */
export async function rememberPassword(id, secret) {
  if (!writePasswordVerifier(id, await verifierFor(secret)) || !writeSyncSecret(id, secret)) throw new Error('local storage');
  writePendingPassword(id, null);
}
/** Enroll a new/legacy local profile. Legacy cloud credentials rotate on the next sync.
 * @param {string} id @param {string} password
 */
export async function setPassword(id, password) {
  if (password.length < 10 || password.length > 256) throw new Error('password');
  const secret = await passwordSecret(id, password);
  const previous = readSyncSecret(id);
  const verifier = await verifierFor(secret);
  if (!canStore) {
    temporaryVerifiers.set(id, verifier);
    return;
  }
  if (!writePasswordVerifier(id, verifier)) throw new Error('local storage');
  if (typeof previous === 'string' && previous !== secret) {
    if (!writePendingPassword(id, secret)) throw new Error('local storage');
  } else if (!writeSyncSecret(id, secret)) throw new Error('local storage');
}
