import { COLORS, isGuest, me, students } from '../core/store.js';
import { syncOn } from '../core/cloud.js';
import { A46 } from '../data/letters.js';
import { t } from '../i18n/core.js';
import { esc } from '../util.js';

/** @param {string} name */
const initialOf = (name) => (Array.from(name.trim())[0] || '?').toUpperCase();
/** @param {import('../../types/app').Student} p @param {string} [cls] */
export function avatar(p, cls) {
  const av = p.av,
    base =
      '<span class="av' +
      (cls ? ' ' + cls : '') +
      (av.t === 'kana' ? ' avkana' : '') +
      '" style="--c:' +
      p.color +
      '" aria-hidden="true">';
  if (av.t === 'photo' && /^data:image\/(jpeg|png);base64,/.test(av.img || ''))
    return base + '<img src="' + av.img + '" alt=""></span>';
  if (av.t === 'kana' && A46.includes(av.k)) return base + av.k + '</span>';
  return base + esc(initialOf(p.name)) + '</span>';
}
/** @param {unknown} v */
export const cleanName = (v) =>
  String(v || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
/** @param {string} name @param {string} [exceptId] */
export const nameTaken = (name, exceptId) =>
  students.list.some((p) => p.id !== exceptId && p.name.toLowerCase() === name.toLowerCase());
/** @param {string} name @param {string} chosen */
export function swatches(name, chosen) {
  return (
    '<fieldset class="swatches"><legend class="small muted">' +
    t('f.colour') +
    '</legend>' +
    COLORS.map(
      (c, i) =>
        '<label class="sw"><input type="radio" name="' +
        name +
        '" value="' +
        c +
        '"' +
        (c === chosen ? ' checked' : '') +
        '><span class="dotc" style="--c:' +
        c +
        '"></span><span class="vh">' +
        t('f.colourN', { n: i + 1 }) +
        '</span></label>',
    ).join('') +
    '</fieldset>'
  );
}

export function syncText() {
  const p = me();
  if (p && isGuest(p.id)) return t('guest.hint');
  return t(syncOn ? 'cloud.hint' : 'sync', { name: p ? esc(p.name) : '' });
}
