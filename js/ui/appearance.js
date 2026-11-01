import { reduceAnim } from '../core/motion.js';
import { goalOf } from '../core/plan.js';
import { cleanTheme, me } from '../core/store.js';
import { readDeviceTheme, writeDeviceTheme } from '../core/storage.js';
import { t } from '../i18n/core.js';
import { $ } from '../util.js';

let themeReady = false;
export const deviceTheme = () => cleanTheme(readDeviceTheme());
/* apply a theme to the page and remember it for this device (used before anyone signs in) */
export function applyTheme(th, remember) {
  th = cleanTheme(th);
  const r = document.documentElement;
  if (themeReady && !reduceAnim()) {
    r.classList.add('themeanim');
    clearTimeout(applyTheme.t);
    applyTheme.t = setTimeout(() => r.classList.remove('themeanim'), 500);
  }
  themeReady = true;
  if (th.mode === 'system') r.removeAttribute('data-theme');
  else r.setAttribute('data-theme', th.mode);
  if (th.tint === 'sage') r.removeAttribute('data-tint');
  else r.setAttribute('data-tint', th.tint);
  if (remember) {
    try {
      writeDeviceTheme(th);
    } catch (e) {}
  }
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', getComputedStyle(document.body).backgroundColor);
}
if (window.matchMedia) {
  try {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () =>
      applyTheme(deviceTheme()),
    );
  } catch (e) {}
}

export function applyStudent() {
  const student = me();
  if (!student) return;
  const goal = goalOf(student);
  document.body.classList.toggle('kid', student.age === 'child');
  applyTheme(student.theme, true);
  $('#appSub').textContent = t('app.subP', { days: goal.pace, min: goal.min });
}
