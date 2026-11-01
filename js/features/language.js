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
const GLOBE_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 12h17M12 3c2.6 2.6 3.8 5.6 3.8 9S14.6 18.4 12 21c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
const CHEVRON_SVG =
  '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHECK_SVG =
  '<svg class="tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
/**
 * The first step: a centred globe, a heading and one large row per language, each in its own script.
 * @param {string} cur the language the page is showing now
 */
export function langStep(cur) {
  return (
    '<div class="langstep"><span class="langglobe">' +
    GLOBE_SVG +
    '</span><h2>' +
    esc(t('lang.choose')) +
    '</h2><div class="langlist" role="group" aria-label="' +
    esc(t('lang')) +
    '">' +
    localeIds()
      .map(
        (l) =>
          '<button type="button" class="langopt" data-lang="' +
          l +
          '" lang="' +
          l +
          '" dir="' +
          localeFor(l).direction +
          '" aria-pressed="' +
          (cur === l) +
          '"><span>' +
          esc(localeLabel(l)) +
          '</span>' +
          (cur === l ? CHECK_SVG : CHEVRON_SVG) +
          '</button>',
      )
      .join('') +
    '</div></div>'
  );
}
/** A small button on the profile form that shows the chosen language and goes back to the first step. @param {string} cur */
export function langChip(cur) {
  return (
    '<div class="langchipwrap"><button type="button" class="langchip" data-change-lang aria-label="' +
    esc(t('lang.change')) +
    '">' +
    GLOBE_SVG +
    '<span lang="' +
    cur +
    '">' +
    esc(localeLabel(cur)) +
    '</span></button></div>'
  );
}
