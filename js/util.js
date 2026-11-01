/**
 * The first element matching `selector`, or null. Elements are taken to be HTMLElements; name another
 * element class as `type` (HTMLInputElement, SVGSVGElement ...) to get that type, checked at run time.
 * @template {Element} [E=HTMLElement]
 * @param {string} selector
 * @param {ParentNode} [root]
 * @param {{new (): E, prototype: E}} [type]
 * @returns {NoInfer<E> | null}
 */
export function $(selector, root, type) {
  const element = (root || document).querySelector(selector);
  if (type && !(element instanceof type)) return null;
  return /** @type {E | null} */ (element);
}
/**
 * The nearest element, starting at the event's target, that matches `selector`.
 * @template {Element} [E=HTMLElement]
 * @param {Event} event
 * @param {string} selector
 * @param {{new (): E, prototype: E}} [type]
 * @returns {NoInfer<E> | null}
 */
export function closest(event, selector, type) {
  const target = event.target;
  const element = target instanceof Element ? target.closest(selector) : null;
  if (type && !(element instanceof type)) return null;
  return /** @type {E | null} */ (element);
}
/**
 * Like `$`, for elements the page always contains (index.html or a card the caller just built).
 * @template {Element} [E=HTMLElement]
 * @param {string} selector
 * @param {ParentNode} [root]
 * @param {{new (): E, prototype: E}} [type]
 * @returns {NoInfer<E>}
 */
export function must(selector, root, type) {
  const element = $(selector, root, type);
  if (!element) throw new Error('Missing ' + (type ? type.name + ' ' : 'element ') + selector);
  return element;
}
/**
 * Every element matching `selector`. See `$` for `type`; elements of another class are left out.
 * @template {Element} [E=HTMLElement]
 * @param {string} selector
 * @param {ParentNode} [root]
 * @param {{new (): E, prototype: E}} [type]
 * @returns {NoInfer<E>[]}
 */
export function $$(selector, root, type) {
  const found = Array.from((root || document).querySelectorAll(selector));
  return /** @type {E[]} */ (type ? found.filter((element) => element instanceof type) : found);
}
/** Whether a value is a non-null object (arrays included); for checking saved or imported data. @param {unknown} value @returns {value is Record<string, unknown>} */
export const isObject = (value) => !!value && typeof value === 'object';
/** The values of a record whose lookups may be missing. @template T @param {Partial<Record<string, T>>} o @returns {T[]} */
export const valuesOf = (o) => /** @type {T[]} */ (Object.values(o).filter((v) => v !== undefined));
/** The [key, value] pairs of a record whose lookups may be missing. @template T @param {Partial<Record<string, T>>} o @returns {[string, T][]} */
export const entriesOf = (o) => /** @type {[string, T][]} */ (Object.entries(o).filter(([, v]) => v !== undefined));
export const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** @param {number} n */
const pad2 = n => String(n).padStart(2, '0');
/** @returns {import('../types/app').ISODate} */
export function todayISO() { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
/** @param {import('../types/app').ISODate} iso */
export function isoToUTC(iso) { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); }
/** @param {import('../types/app').ISODate} iso @param {number} n @returns {import('../types/app').ISODate} */
export function addDays(iso, n) { const t = new Date(isoToUTC(iso) + n * 86400000); return t.getUTCFullYear() + '-' + pad2(t.getUTCMonth() + 1) + '-' + pad2(t.getUTCDate()); }
/** Shuffles in place and returns the same array. @template T @param {T[]} a @returns {T[]} */
export function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/** @template T @param {Iterable<T>} a @returns {T[]} */
export const uniq = a => Array.from(new Set(a));
export const SPEAK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 8.8a4.5 4.5 0 0 1 0 6.4M18 6.3a8 8 0 0 1 0 11.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
export const MARK_SVG = '<svg class="mark" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="41" pathLength="100" transform="rotate(-110 50 50)"/><path d="M26 26 L74 74 M74 26 L26 74" pathLength="100"/></svg>';
/** @type {Readonly<Record<string, string>>} */
const HTML_ESCAPES = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
/** @param {unknown} s */
export function esc(s) { return String(s).replace(/[&<>"']/g, c => HTML_ESCAPES[c]); }
