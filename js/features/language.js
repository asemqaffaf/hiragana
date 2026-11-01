import {renderBack} from '../core/nav.js';
import {LANGS, me, students} from '../core/storage.js';
import {applyStudent} from './profile.js';
import {LANG, replaceLang, t} from '../i18n/core.js';
import {$, $$} from '../util.js';

/* ---------- language ---------- */
export function deviceLang() { return students.lang || (/^ar\b/i.test(navigator.language || '') ? 'ar' : 'en'); }
export function setLang(l) {
  replaceLang(LANGS.includes(l) ? l : 'en');
  const html = document.documentElement;
  html.lang = LANG; html.dir = LANG === 'ar' ? 'rtl' : 'ltr';
  document.title = t('doc.title');
  if (me() && !document.body.classList.contains('signed-out')) applyStudent(); else $('#appSub').textContent = t('app.sub');
  $('nav.tabs').setAttribute('aria-label', t('nav.label'));
  $$('nav.tabs button').forEach(b => { $('.tl', b).textContent = t('nav.' + b.dataset.nav); });
  $('#login').setAttribute('aria-label', t('login.region'));
  $$('.tab').forEach(s => s.setAttribute('aria-label', t('tab.' + s.id.slice(4))));
  renderBack();
}
export function langSeg(cur, cls) {
  return '<div class="seg ' + (cls || '') + '" role="group" aria-label="Language / اللغة">' + LANGS.map(l => '<button type="button" data-lang="' + l + '" lang="' + l + '" aria-pressed="' + (cur === l) + '">' + (l === 'en' ? 'English' : 'العربية') + '</button>').join('') + '</div>';
}
