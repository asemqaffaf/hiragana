import { DEFAULT_LANGUAGE, localeFor } from './core.js';

/** @param {import('../../types/app').LocaleString | undefined} text */
const placeholders = (text) =>
  typeof text === 'string'
    ? [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))].sort()
    : null;

/**
 * Compares a locale's interface strings with the English source.
 * @param {string} id
 */
export function auditLocale(id) {
  const source = localeFor(DEFAULT_LANGUAGE).strings;
  const target = localeFor(id).strings;
  const missing = Object.keys(source).filter((key) => target[key] == null || target[key] === '');
  const extra = Object.keys(target).filter((key) => source[key] === undefined);
  /** @type {{key: string, expected: string[], actual: string[]}[]} */
  const mismatched = [];
  /** @type {{key: string, expected: string}[]} */
  const invalidTypes = [];
  for (const key of Object.keys(target)) {
    if (missing.includes(key) || extra.includes(key)) continue;
    const value = target[key];
    if (Array.isArray(source[key])) {
      if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
        invalidTypes.push({ key, expected: 'array of strings' });
      }
    } else if (typeof value !== 'string' && typeof value !== 'function') {
      invalidTypes.push({ key, expected: 'string or function' });
    }
    const expected = placeholders(source[key]),
      actual = placeholders(target[key]);
    if (expected && actual && expected.join(',') !== actual.join(',')) {
      mismatched.push({ key, expected, actual });
    }
  }
  return {
    id,
    translated: Object.keys(source).length - missing.length,
    total: Object.keys(source).length,
    missing,
    extra,
    mismatched,
    invalidTypes,
  };
}
