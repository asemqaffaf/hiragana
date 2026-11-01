import { COLORS, me, students } from '../core/store.js';
import { A46 } from '../data/letters.js';
import { t } from '../i18n/core.js';
import { esc } from '../util.js';

const initialOf = (name) => (Array.from(name.trim())[0] || '?').toUpperCase();
export function avatar(p, cls) {
  const av = p.av || {},
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
export const cleanName = (v) =>
  String(v || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
export const nameTaken = (name, exceptId) =>
  students.list.some((p) => p.id !== exceptId && p.name.toLowerCase() === name.toLowerCase());
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
  return t('sync', { name: p ? esc(p.name) : '' });
}
