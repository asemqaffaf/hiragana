import {
  readPasswordVerifier, readRememberedLogin, readSyncSecret, writeRememberedLogin,
} from './storage.js';

/** A remembered login lasts a year after the last time the app was opened, and every launch renews it. */
export const REMEMBER_LOGIN_MS = 365 * 24 * 60 * 60 * 1000;

/** Device-local convenience only; cloud requests still need the existing bearer credential.
 * @param {string} id
 */
export function rememberLogin(id) {
  const verifier = readPasswordVerifier(id);
  const secret = readSyncSecret(id);
  if (typeof verifier !== 'string' || !verifier || typeof secret !== 'string' || !secret) return false;
  return writeRememberedLogin({ id, verifier, expiresAt: Date.now() + REMEMBER_LOGIN_MS });
}

/** @param {string} [id] Clear all remembered login state, or only this student's. */
export function forgetLogin(id) {
  const login = readRememberedLogin();
  if (!id || (login && typeof login === 'object' && 'id' in login && login.id === id)) {
    writeRememberedLogin(null);
  }
}

/** Validate expiry and the current local credentials, then slide the expiry forward: only a year without opening the app forgets you. */
export function rememberedStudent() {
  const login = readRememberedLogin();
  const now = Date.now();
  if (login && typeof login === 'object' && !Array.isArray(login) &&
      'id' in login && typeof login.id === 'string' && login.id &&
      'expiresAt' in login && typeof login.expiresAt === 'number' && Number.isFinite(login.expiresAt) &&
      login.expiresAt > now && login.expiresAt <= now + REMEMBER_LOGIN_MS &&
      'verifier' in login && typeof login.verifier === 'string' && login.verifier &&
      login.verifier === readPasswordVerifier(login.id)) {
    const secret = readSyncSecret(login.id);
    if (typeof secret === 'string' && secret) {
      // Renew at most once a day, so a launch does not rewrite storage every time.
      if (login.expiresAt - now < REMEMBER_LOGIN_MS - 24 * 60 * 60 * 1000) {
        writeRememberedLogin({ id: login.id, verifier: login.verifier, expiresAt: now + REMEMBER_LOGIN_MS });
      }
      return login.id;
    }
  }
  forgetLogin();
  return null;
}
