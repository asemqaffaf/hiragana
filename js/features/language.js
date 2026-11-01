import { renderBack } from '../core/nav.js';
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
import { $, $$, esc } from '../util.js';

/* ---------- language ---------- */
export function deviceLang() {
  return students.lang || detectLocale(navigator.languages || [navigator.language || '']);
}
export function setLang(l) {
  replaceLang(l);
  const html = document.documentElement;
  html.lang = LANG;
  html.dir = localeFor().direction;
  document.title = t('doc.title');
  if (me() && !document.body.classList.contains('signed-out')) applyStudent();
  else $('#appSub').textContent = t('app.sub');
  $('nav.tabs').setAttribute('aria-label', t('nav.label'));
  $$('nav.tabs button').forEach((b) => {
    $('.tl', b).textContent = t('nav.' + b.dataset.nav);
  });
  $('#login').setAttribute('aria-label', t('login.region'));
  $$('.tab').forEach((s) => s.setAttribute('aria-label', t('tab.' + s.id.slice(4))));
  renderBack();
}
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
