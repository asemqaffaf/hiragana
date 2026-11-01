import { AGES, JLEVELS, MINUTES, PACES, REASONS, sectionsFor } from '../core/goals.js';
import { PHRASES } from '../data/daily.js';
import { hasKey, localeFor, localeIds, localeLabel, t } from '../i18n/core.js';
import { phraseTitle } from '../i18n/helpers.js';

/** A value and the label shown for it. @typedef {[value: string | number, label: string]} Option */
/**
 * A labelled drop-down.
 * @param {string} id
 * @param {Option[]} opts
 * @param {string | number} cur the selected value
 * @param {string} label
 * @param {string} [hint] text under the field
 */
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
/** @returns {Option[]} */
export const paceOpts = () => PACES.map((x) => [x, t(`pace.${x}`)]);
/** @returns {Option[]} */
export const minOpts = () => MINUTES.map((x) => [x, t('min.n', { n: x })]);
/** @returns {Option[]} */
export const ageOpts = () => AGES.map((x) => [x, t(`age.${x}`)]);
/** @returns {Option[]} */
export const jlOpts = () => JLEVELS.map((x) => [x, t(`jl.${x}`)]);
/** @returns {Option[]} */
export const reasonOpts = () => REASONS.map((x) => [x, t(`goal.reason.${x}`)]);
/* under the "Why are you learning?" box: which phrase sections that goal opens (all of them for Everything) */
/** @param {import('../../types/app').Reason} r */
export const goalHint = (r) =>
  r === 'all'
    ? t('goal.hintAll')
    : t('goal.hint', {
        list: sectionsFor(r, PHRASES).map(phraseTitle).join(localeFor().listSeparator),
      });
/** @returns {Option[]} */
/** @returns {Option[]} */
export const languageOpts = () => localeIds().map((id) => [id, localeLabel(id)]);
/** @returns {Option[]} */
export const rateOpts = () => [
  [1, t('rate.1')],
  [0.75, t('rate.slow')],
];
/** @returns {Option[]} */
export const nativeOpts = () =>
  [...new Set([...localeIds(), 'ja', 'other'])].map((id) => {
    const key = 'nat.' + id;
    return [id, hasKey(key) ? t(key) : localeLabel(id)];
  });
document.addEventListener('change', (e) => {
  const s = e.target;
  if (s instanceof HTMLSelectElement && (s.id === 'pfReason' || s.id === 'nsReason')) {
    const h = document.getElementById(s.id + 'Hint');
    const reason = REASONS.find((r) => r === s.value);
    if (h && reason) h.textContent = goalHint(reason);
  }
});
