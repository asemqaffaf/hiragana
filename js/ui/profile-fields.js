import { REASONS, sectionsFor } from '../core/goals.js';
import { PHRASES } from '../data/daily.js';
import { localeFor, localeIds, localeLabel, t } from '../i18n/core.js';
import { phraseTitle } from '../i18n/helpers.js';

const AGES = ['child', 'teen', 'adult'],
  JLEVELS = ['new', 'some', 'all'];
const PACES = [7, 14, 21],
  MINS = [10, 20, 30];
export function sel(id, opts, cur, label, hint) {
  return (
    '<label class="field"><span class="small muted">' +
    label +
    '</span><select id="' +
    id +
    '"' +
    (hint ? ' aria-describedby="' + id + 'Hint"' : '') +
    '>' +
    opts
      .map(
        (o) =>
          '<option value="' +
          o[0] +
          '"' +
          (String(o[0]) === String(cur) ? ' selected' : '') +
          '>' +
          o[1] +
          '</option>',
      )
      .join('') +
    '</select>' +
    (hint
      ? '<span class="small muted goalhint" id="' +
        id +
        'Hint" aria-live="polite">' +
        hint +
        '</span>'
      : '') +
    '</label>'
  );
}
export const paceOpts = () => PACES.map((x) => [x, t('pace.' + x)]);
export const minOpts = () => MINS.map((x) => [x, t('min.n', { n: x })]);
export const ageOpts = () => AGES.map((x) => [x, t('age.' + x)]);
export const jlOpts = () => JLEVELS.map((x) => [x, t('jl.' + x)]);
export const reasonOpts = () => REASONS.map((x) => [x, t('goal.reason.' + x)]);
/* under the "Why are you learning?" box: which phrase sections that goal opens (all of them for Everything) */
export const goalHint = (r) =>
  r === 'all'
    ? t('goal.hintAll')
    : t('goal.hint', {
        list: sectionsFor(r, PHRASES).map(phraseTitle).join(localeFor().listSeparator),
      });
export const nativeOpts = () =>
  [...new Set([...localeIds(), 'ja', 'other'])].map((id) => {
    const key = 'nat.' + id,
      label = t(key);
    return [id, label === key ? localeLabel(id) : label];
  });
document.addEventListener('change', (e) => {
  const s = e.target;
  if (s && (s.id === 'pfReason' || s.id === 'nsReason')) {
    const h = document.getElementById(s.id + 'Hint');
    if (h) h.textContent = goalHint(s.value);
  }
});
