import { reduceAnim } from '../core/motion.js';
import { createLens } from './lens.js';

/**
 * @typedef {{
 *   kind: 'tab' | 'seg',
 *   c: HTMLElement,
 *   id: number,
 *   x0: number,
 *   y0: number,
 *   x: number,
 *   lens: import('./lens.js').Lens | null,
 *   timer?: ReturnType<typeof setTimeout>,
 * }} DragState
 */

/** @type {DragState | null} */
let drag = null;

document.addEventListener(
  'pointerdown',
  (e) => {
    if (e.button > 0) return;
    const t = /** @type {Element | null} */ (e.target);
    if (!t) return;
    const c = /** @type {HTMLElement | null} */ (t.closest('.seg, nav.tabs .in'));
    if (!c) return;
    const b = /** @type {HTMLButtonElement | null} */ (t.closest('button'));
    if (!b || !c.contains(b) || b.disabled) return;
    const kind = c.matches('nav.tabs .in') ? 'tab' : 'seg';
    /* On touch, preventDefault on nav.tabs .in keeps vertical scroll from hijacking the tab bar;
       on .seg, vertical scrolling stays preserved until horizontal drag activates the lens. */
    if (kind === 'tab' && e.pointerType === 'touch') e.preventDefault();
    /** @type {DragState} */
    const d = { kind, c, id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, lens: null };
    if (kind === 'tab' && !reduceAnim()) {
      d.timer = setTimeout(() => {
        if (drag === d && !d.lens) d.lens = createLens(c, d.x);
      }, 110);
    }
    drag = d;
  },
  true,
);

document.addEventListener('pointermove', (e) => {
  const d = drag;
  if (!d || e.pointerId !== d.id) return;
  d.x = e.clientX;
  if (!d.lens) {
    const dx = Math.abs(e.clientX - d.x0);
    const dy = Math.abs(e.clientY - d.y0);
    if (d.kind === 'seg' && dy > dx && dy >= 6) {
      drag = null;
      return;
    }
    if (dx >= 6) d.lens = createLens(d.c, e.clientX);
  }
  if (d.lens) d.lens.move(e.clientX);
});

/** @param {PointerEvent} e @param {boolean} cancel */
const end = (e, cancel) => {
  const d = drag;
  if (!d || e.pointerId !== d.id) return;
  drag = null;
  clearTimeout(d.timer);
  if (!d.lens) return;
  const chosen = d.lens.release(e.clientX, cancel);
  if (
    chosen &&
    Math.abs(e.clientX - d.x0) >= 8 &&
    chosen.getAttribute('aria-selected') !== 'true' &&
    chosen.getAttribute('aria-pressed') !== 'true'
  ) {
    chosen.click();
  }
};

/* belt and braces for iOS: prevent page scroll on tab bar or once a .seg lens is active */
document.addEventListener(
  'touchmove',
  (e) => {
    if (drag && (drag.kind === 'tab' || drag.lens) && e.cancelable) e.preventDefault();
  },
  { passive: false, capture: true },
);
document.addEventListener('pointerup', (e) => end(e, false), true);
document.addEventListener('pointercancel', (e) => end(e, true), true);
