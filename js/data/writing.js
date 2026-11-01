import { DROWS, ROWS } from './letters.js';

export const WGROUPS = [
  ...ROWS.map((r) => ({ id: r.id, label: r.kana[0], kana: r.kana.filter(Boolean) })),
  ...DROWS.map((r) => ({ id: r.id, label: r.kana[0], kana: r.kana })),
  { id: 'sm', label: 'ゃ', kana: ['ゃ', 'ゅ', 'ょ', 'っ'] },
];
export function groupOf(k) {
  const g = WGROUPS.find((g) => g.kana.includes(k));
  return g ? g.id : 'a';
}
