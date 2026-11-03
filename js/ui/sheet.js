import { bindSay, speakFull } from '../core/audio.js';

import { markSheetOpen, showTab } from '../core/nav.js';
import { st } from '../core/stats.js';
import { state } from '../core/store.js';
import { ui } from '../core/ui-state.js';
import { FULL_SIZE, rom } from '../data/letters.js';
import { groupOf } from '../data/writing.js';
import { closeSheet } from './sheet-state.js';
import { t } from '../i18n/core.js';
import { letterNotesHtml } from './letter-notes.js';
import { strokeCount } from '../strokes/check.js';
import { strokeSVG } from '../strokes/draw.js';
import { $, $$, SPEAK_SVG, closest, must } from '../util.js';

/** The card for a letter: stroke order, hook, example words and buttons. @param {string} k */
function openSheet(k) {
  const replacing = !!must('#sheetRoot').innerHTML;
  closeSheet('replace');
  if (!replacing) ui.lastFocus = document.activeElement;
  const parts = k.length === 2 ? [k[0], k[1]] : [k];
  const s = st(k);
  const statLine =
    s.c + s.w
      ? t('card.drilled', { n: s.c + s.w, c: s.c, avg: s.t ? (s.t / 1000).toFixed(1) : '' })
      : t('card.notDrilled');
  const sc = parts.reduce((sum, part) => sum + (strokeCount(part) ?? 0), 0);
  const combo = parts.length > 1;
  let h =
    '<div class="scrim" data-close></div><div class="sheet" role="dialog" aria-modal="true" aria-label="' +
    k +
    '"><div class="in"><div class="grab"></div>';
  h +=
    '<div class="big"><div class="sq" data-slot="0">' +
    (combo ? '<span class="k txt">' + k + '</span>' : '') +
    '</div><div class="rom">' +
    rom(k) +
    '<small>' +
    t('strokes', { n: sc }) +
    '</small></div></div>';
  h += letterNotesHtml(k);
  if (combo)
    h +=
      '<p class="small muted">' +
      t('card.combo', {
        base:
          '<button class="link" data-open="' +
          parts[0] +
          '"><span style="font-family:var(--kana);font-size:18px">' +
          parts[0] +
          '</span> (' +
          rom(parts[0]) +
          ')</button>',
        s: parts[1],
        big: FULL_SIZE[parts[1]],
      }) +
      '</p>';
  const wr = (state.ws || {})[k];
  h +=
    '<p class="small muted">' +
    statLine +
    (wr && wr.n ? t('card.written', { n: wr.n, p: wr.p }) : '') +
    '</p>';
  h +=
    '<div class="btnrow">' +
    (combo ? '' : '<button class="btn" id="shPlay">' + t('card.play') + '</button>') +
    '<button class="btn" id="shSay">' +
    SPEAK_SVG.replace('<svg', '<svg width="20" height="20"') +
    ' ' +
    t('card.hear') +
    '</button></div>';
  h +=
    '<div class="btnrow"><button class="btn primary" id="shWrite">' +
    t('card.write') +
    '</button><button class="btn" data-close>' +
    t('close') +
    '</button></div>';
  h += '</div></div>';
  const root = must('#sheetRoot');
  root.classList.toggle('swap', replacing);
  root.innerHTML = h;
  bindSay(root);
  const svg = combo ? null : strokeSVG(k, { guide: true });
  if (svg) must('[data-slot="0"]', root).appendChild(svg);
  const pl = $('#shPlay', root);
  if (pl && svg) pl.onclick = () => svg.play();
  must('#shSay', root).onclick = () => {
    if (!speakFull(k)) must('#shSay', root).textContent = t('noSpeech');
  };
  must('#shWrite', root).onclick = () => {
    ui.writeK = parts[0];
    ui.writeGroup = groupOf(ui.writeK);
    const had = closeSheet('nav');
    showTab('write', { replace: had });
  };
  $$('[data-close]', root).forEach((b) => (b.onclick = () => closeSheet()));
  markSheetOpen();
  (pl || must('#shSay', root, HTMLElement)).focus({ preventScroll: true });
  if (svg) setTimeout(() => svg.play(), 250);
}
document.addEventListener('click', (e) => {
  const opener = closest(e, '[data-open]');
  if (opener?.dataset.open) {
    e.preventDefault();
    openSheet(opener.dataset.open);
  }
});
