import {reduceAnim} from '../core/motion.js';
import {closeSheet} from './sheet.js';

/* swipe a sheet down to close it, like iOS: it follows the finger, the backdrop fades, and it either goes or springs back */
(function () {
  const root = document.getElementById('sheetRoot'); if (!root) return;
  let d = null;
  const sheetEl = () => root.querySelector('.sheet'), scrimEl = () => root.querySelector('.scrim');
  root.addEventListener('touchstart', e => {
    const s = sheetEl(); if (!s || !e.touches || e.touches.length !== 1 || !s.contains(e.target)) { d = null; return; }
    if (e.target.closest && e.target.closest('input,select,textarea')) { d = null; return; }
    const tc = e.touches[0];
    d = {s, y0: tc.clientY, x0: tc.clientX, grab: !!(e.target.closest && e.target.closest('.grab')), on: false, dy: 0, ly: tc.clientY, lt: performance.now(), v: 0};
  }, {passive: true});
  /* while a sheet is open the page behind it must not move */
  new MutationObserver(() => document.documentElement.classList.toggle('sheet-open', !!sheetEl())).observe(root, {childList: true});
  root.addEventListener('touchmove', e => {
    if (!d) {
      const s = sheetEl();
      if (s && e.cancelable && !(e.target.closest && e.target.closest('input,select,textarea')) && (!s.contains(e.target) || s.scrollHeight <= s.clientHeight + 1)) e.preventDefault();
      return;
    }
    const tc = e.touches[0], dy = tc.clientY - d.y0, dx = tc.clientX - d.x0, now = performance.now();
    if (!d.on) {
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) { d = null; return; }
      if (dy < -6 && !d.grab) { if (d.s.scrollHeight <= d.s.clientHeight + 1 && e.cancelable) e.preventDefault(); d = null; return; }
      if (!d.grab && d.s.scrollTop > 0) { d = null; return; }
      if (dy > 0 && e.cancelable) e.preventDefault();   /* claim it now: once iOS starts its own bounce it is too late */
      if (dy < 6) return;
      d.on = true; d.y0 = tc.clientY; d.s.style.animation = 'none'; d.s.style.transition = 'none';
      const sc = scrimEl(); if (sc) { sc.style.animation = 'none'; sc.style.transition = 'none'; }
    }
    if (e.cancelable) e.preventDefault();
    d.dy = Math.max(0, tc.clientY - d.y0);
    const dt = now - d.lt; if (dt > 0) d.v = 0.6 * d.v + 0.4 * ((tc.clientY - d.ly) / dt);
    d.ly = tc.clientY; d.lt = now;
    d.s.style.transform = 'translateY(' + d.dy + 'px)';
    const sc = scrimEl(); if (sc) sc.style.opacity = String(Math.max(0, 1 - d.dy / Math.max(1, d.s.offsetHeight) * 0.9));
  }, {passive: false});
  const finish = cancel => {
    const x = d; d = null; if (!x || !x.on) return;
    const s = x.s, sc = scrimEl(), h = s.offsetHeight, fast = reduceAnim();
    const go = !cancel && (x.dy > Math.min(140, h * 0.3) || (x.v > 0.5 && x.dy > 30));
    if (go) {
      if (fast) { closeSheet('dragged'); return; }
      s.style.transition = 'transform .24s cubic-bezier(.4,0,1,1)'; s.style.transform = 'translateY(100%)';
      if (sc) { sc.style.transition = 'opacity .24s'; sc.style.opacity = '0'; }
      setTimeout(() => { if (sheetEl() === s) closeSheet('dragged'); }, 240);
    } else {
      s.style.transition = fast ? 'none' : 'transform .28s cubic-bezier(.2,.8,.2,1)'; s.style.transform = '';
      if (sc) { sc.style.transition = fast ? 'none' : 'opacity .28s'; sc.style.opacity = ''; }
      setTimeout(() => { if (sheetEl() === s) { s.style.transition = ''; if (sc) sc.style.transition = ''; } }, 300);
    }
  };
  root.addEventListener('touchend', () => finish(false));
  root.addEventListener('touchcancel', () => finish(true));
})();
