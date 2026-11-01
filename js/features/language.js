import { isTab, renderBack } from '../core/nav.js';
import { me, students } from '../core/store.js';
import { applyStudent } from '../ui/appearance.js';
import { moveThumb } from '../ui/thumb.js';
import {
  LANG,
  detectLocale,
  localeFor,
  localeIds,
  localeLabel,
  replaceLang,
  t,
} from '../i18n/core.js';
import { $, $$, esc, must } from '../util.js';

/* ---------- language ---------- */
/** The language for people who have not signed in: the saved device choice, else the browser's. */
export function deviceLang() {
  return students.lang || detectLocale(navigator.languages || [navigator.language || '']);
}
/** Text of the bottom tabs, keyed by their `data-nav`. @type {Record<string, import('../../types/app').TextKey>} */
const NAV_LABELS = {
  home: 'nav.home',
  letters: 'nav.letters',
  practice: 'nav.practice',
  progress: 'nav.progress',
};
/** Switches the whole page to a language; an unknown one means English. @param {string | null} l */
export function setLang(l) {
  replaceLang(l);
  const html = document.documentElement;
  html.lang = LANG;
  html.dir = localeFor().direction;
  document.title = t('doc.title');
  if (me() && !document.body.classList.contains('signed-out')) applyStudent();
  else must('#appSub').textContent = t('app.sub');
  must('nav.tabs').setAttribute('aria-label', t('nav.label'));
  $$('nav.tabs button').forEach((b) => {
    const label = NAV_LABELS[b.dataset.nav ?? ''];
    if (label) must('.tl', b).textContent = t(label);
  });
  must('#login').setAttribute('aria-label', t('login.region'));
  $$('.tab').forEach((s) => {
    const name = s.id.slice(4);
    if (isTab(name)) s.setAttribute('aria-label', t(`tab.${name}`));
  });
  renderBack();
}
/** Up to this many languages fit in one pill. */
const MAX_PILL = 3;
const GLOBE_SVG =
  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 12h17M12 3c2.6 2.6 3.8 5.6 3.8 9S14.6 18.4 12 21c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
/** The language buttons. @param {string} cur the selected language @param {string} [cls] */
export function langSeg(cur, cls) {
  const many = localeIds().length > MAX_PILL;
  return (
    '<div class="langpick"><span class="langcue" aria-hidden="true">' +
    GLOBE_SVG +
    esc(t('lang')) +
    '</span><div class="seg language-options ' +
    (cls || '') +
    (many ? ' many' : '') +
    '" role="group" aria-label="' +
    esc(t('lang')) +
    '">' +
    localeIds()
      .map(
        (l) =>
          '<button type="button" data-lang="' +
          l +
          '" lang="' +
          l +
          '" dir="' +
          localeFor(l).direction +
          '" aria-pressed="' +
          (cur === l) +
          '">' +
          esc(localeLabel(l)) +
          '</button>',
      )
      .join('') +
    '</div></div>'
  );
}
/** Gives the language pill its gliding glass thumb; with many languages the buttons wrap and mark themselves. @param {ParentNode} root */
export function glideLangSeg(root) {
  const seg = $('.langseg', root);
  if (seg && !seg.classList.contains('many')) moveThumb(seg, 'lang');
}
