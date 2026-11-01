import { FULL_SIZE, baseOf, rom } from '../data/letters.js';
import { DNOTE_AR, DRULE_AR, HOOK_AR } from './ar-content.js';
import { iso } from './format.js';

/** @param {string} k */
export function explainArabic(k) {
  if (HOOK_AR[k]) return HOOK_AR[k];
  const d = baseOf(k);
  if (d)
    return (
      iso(
        d.base +
          ' (' +
          rom(d.base) +
          ') + ' +
          (d.row.id === 'p' ? '゜' : '゛') +
          ' = ' +
          k +
          ' (' +
          rom(k) +
          ')',
      ) +
      '. ' +
      DRULE_AR[d.row.id] +
      (DNOTE_AR[k] ? ' ' + DNOTE_AR[k] : '')
    );
  if (k.length === 2) {
    const b = k[0],
      s = k[1],
      big = FULL_SIZE[s];
    return (
      iso(b + ' (' + rom(b) + ') + ' + s + ' = ' + k + ' (' + rom(k) + ')') +
      '، تُنطق نبضة واحدة لأن ' +
      s +
      ' صغيرة. لو كُتبت بحجم كامل ' +
      b +
      big +
      ' لصارت نبضتين: ' +
      iso(rom(b) + '-' + rom(big)) +
      '.'
    );
  }
  return '';
}
