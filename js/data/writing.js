import { DROWS, ROWS, kanaOf } from './letters.js';

/** @type {import('../../types/app').WriteGroup[]} */
export const WGROUPS = [
  ...ROWS.map((r) => ({ id: r.id, label: kanaOf(r)[0], kana: kanaOf(r) })),
  ...DROWS.map((r) => ({ id: r.id, label: r.kana[0], kana: r.kana })),
  { id: 'sm', label: 'ゃ', kana: ['ゃ', 'ゅ', 'ょ', 'っ'] },
];
/** The write-group id a letter belongs to. @param {string} k */
export function groupOf(k) {
  const g = WGROUPS.find((g) => g.kana.includes(k));
  return g ? g.id : 'a';
}
