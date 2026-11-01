import { isTab, renderBack } from '../core/nav.js';
import { me, students } from '../core/store.js';
import { applyStudent } from '../ui/appearance.js';
import {
  LANG,
  detectLocale,
  localeFor,
  localeIds,
  localeLabel,
  replaceLang,
  t,
} from '../i18n/core.js';
import { $$, esc, must } from '../util.js';

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
/** The language buttons. @param {string} cur the selected language @param {string} [cls] */
export function langSeg(cur, cls) {
  return (
    '<div class="seg language-options ' +
    (cls || '') +
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
    '</div>'
  );
}
