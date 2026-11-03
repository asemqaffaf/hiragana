import { DROWS, FULL_SIZE, ROWS, kanaOf } from '../data/letters.js';

/** The suggested practice sequence. Every step can also be opened directly. @type {readonly import('../../types/app').TabName[]} */
export const PRACTICE_STEPS = ['write', 'read', 'phrases', 'drill'];

/** @param {import('../../types/app').TabName} current */
export function nextPracticeStep(current) {
  const i = PRACTICE_STEPS.indexOf(current);
  return i >= 0 ? PRACTICE_STEPS[i + 1] ?? null : null;
}

/** A quiz reviews the row containing the practised letter. @param {string} kana */
export function practiceQuizPreset(kana) {
  const base = kana === 'っ' ? 'つ' : FULL_SIZE[kana] || kana[0];
  const row = [...ROWS, ...DROWS].find((r) => kanaOf(r).includes(base));
  return row ? 'row-' + row.id : null;
}
