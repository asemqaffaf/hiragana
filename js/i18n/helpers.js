import {PLAN} from '../data/content.js';
import {baseOf, explainEn, rom} from '../data/letters.js';
import {DNOTE_AR, DRULE_AR, HOOK_AR, MEAN_AR, PLAN_AR, SENT_AR, WTITLE_AR} from './ar-content.js';
import {isAr, iso, t} from './core.js';
import {isoToUTC} from '../util.js';

/* language-aware content accessors */
const planOf = i => isAr() ? PLAN_AR[i] : PLAN[i];
export const meanOf = w => isAr() ? (MEAN_AR[w[0]] || SENT_AR[w[0]] || w[2]) : w[2];
export const wtitleOf = g => isAr() ? WTITLE_AR[g.id] : g.title;
export function explain(k) {
  if (!isAr()) return explainEn(k);
  if (HOOK_AR[k]) return HOOK_AR[k];
  const d = baseOf(k);
  if (d) return iso(d.base + ' (' + rom(d.base) + ') + ' + (d.row.id === 'p' ? '゜' : '゛') + ' = ' + k + ' (' + rom(k) + ')') + '. ' + DRULE_AR[d.row.id] + (DNOTE_AR[k] ? ' ' + DNOTE_AR[k] : '');
  if (k.length === 2) {
    const b = k[0], s = k[1], big = {'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ'}[s];
    return iso(b + ' (' + rom(b) + ') + ' + s + ' = ' + k + ' (' + rom(k) + ')') + '، تُنطق نبضة واحدة لأن ' + s + ' صغيرة. لو كُتبت بحجم كامل ' + b + big + ' لصارت نبضتين: ' + iso(rom(b) + '-' + rom(big)) + '.';
  }
  return '';
}
const fmtLocale = () => t('date.locale');
export function fmt(iso, long) {
  const t = new Date(isoToUTC(iso));
  return t.toLocaleDateString(fmtLocale(), long ? {weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'UTC'} : {weekday:'short', day:'numeric', month:'short', timeZone:'UTC'});
}
