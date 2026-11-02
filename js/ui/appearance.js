import { reduceAnim } from '../core/motion.js';
import { goalOf } from '../core/plan.js';
import { cleanTheme, me } from '../core/store.js';
import { readDeviceTheme, writeDeviceTheme } from '../core/storage.js';
import { t } from '../i18n/core.js';
import { must } from '../util.js';

let themeReady = false;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let themeTimer;
export const deviceTheme = () => cleanTheme(readDeviceTheme());
/* apply a theme to the page and remember it for this device (used before anyone signs in) */
/** @param {unknown} theme @param {boolean} [remember] */
export function applyTheme(theme, remember) {
  const th = cleanTheme(theme);
  const r = document.documentElement;
  if (themeReady && !reduceAnim()) {
    r.classList.add('themeanim');
    clearTimeout(themeTimer);
    themeTimer = setTimeout(() => r.classList.remove('themeanim'), 500);
  }
  themeReady = true;
  if (th.mode === 'system') r.removeAttribute('data-theme');
  else r.setAttribute('data-theme', th.mode);
  if (th.tint === 'slate') r.removeAttribute('data-tint');
  else r.setAttribute('data-tint', th.tint);
  if (remember) {
    try {
      writeDeviceTheme(th);
    } catch (e) {}
  }
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', getComputedStyle(document.body).backgroundColor);
}
try {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () =>
    applyTheme(deviceTheme()),
  );
} catch (e) {}

export function applyStudent() {
  const student = me();
  if (!student) return;
  const goal = goalOf(student);
  document.body.classList.toggle('kid', student.age === 'child');
  applyTheme(student.theme, true);
  must('#appSub').textContent = t('app.subP', { days: goal.pace, min: goal.min });
}
