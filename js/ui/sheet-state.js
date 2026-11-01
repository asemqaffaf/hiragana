import { reduceAnim } from '../core/motion.js';
import { ui } from '../core/ui-state.js';
import { $, must } from '../util.js';

/* mode: 'replace' = another card is about to take its place; 'pop' = the back gesture already left the card's
   history entry; 'nav' = leaving for another page, which takes over the card's entry; 'silent' = no focus return */
/** @param {import('../../types/app').SheetCloseMode} [mode] */
export function closeSheet(mode) {
  const root = must('#sheetRoot');
  if (!root.innerHTML) return false;
  const sh = $('.sheet', root);
  if (sh && sh.classList.contains('out')) return false; /* already sliding away */
  if (
    !sh ||
    reduceAnim() ||
    mode === 'replace' ||
    mode === 'nav' ||
    mode === 'silent' ||
    mode === 'dragged'
  )
    root.innerHTML = '';
  else {
    sh.classList.add('out');
    const sc = $('.scrim', root);
    if (sc) sc.classList.add('out');
    setTimeout(() => {
      if (sh.isConnected && sh.classList.contains('out')) root.innerHTML = '';
    }, 230);
  }
  if (mode === 'replace') return false;
  const had = ui.sheetPushed;
  if (mode !== 'pop') {
    ui.sheetPushed = false;
    if (had && mode !== 'nav') {
      try {
        history.back();
      } catch (e) {}
    }
  }
  if (mode !== 'silent' && mode !== 'nav' && ui.lastFocus instanceof HTMLElement)
    ui.lastFocus.focus();
  return had;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
});
