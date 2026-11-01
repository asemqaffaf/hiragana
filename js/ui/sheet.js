import { bindSay, exampleHtml, moreExHtml, speakFull } from '../core/audio.js';

import { markSheetOpen, showTab } from '../core/nav.js';
import { st } from '../core/stats.js';
import { state } from '../core/store.js';
import { ui } from '../core/ui-state.js';
import { LOOK, rom } from '../data/letters.js';
import { groupOf } from '../data/writing.js';
import { closeSheet } from './sheet-state.js';
import { t } from '../i18n/core.js';
import { explain } from '../i18n/helpers.js';
import { strokeCount } from '../strokes/check.js';
import { strokeSVG } from '../strokes/draw.js';
import { $, $$, SPEAK_SVG } from '../util.js';

function openSheet(k) {
  const replacing = !!$('#sheetRoot').innerHTML;
  closeSheet('replace');
  if (!replacing) ui.lastFocus = document.activeElement;
  const parts = k.length === 2 ? [k[0], k[1]] : [k];
  const s = st(k);
  const statLine =
    s.c + s.w
      ? t('card.drilled', { n: s.c + s.w, c: s.c, avg: s.t ? (s.t / 1000).toFixed(1) : '' })
      : t('card.notDrilled');
  const looks = LOOK[k] || [];
  const sc = parts
    .map(strokeCount)
    .filter(Boolean)
    .reduce((a, b) => a + b, 0);
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
  h += '<p class="hook">' + explain(k) + '</p>' + exampleHtml(k) + moreExHtml(k);
  if (looks.length)
    h +=
      '<p class="small muted">' +
      t('card.mixUp', {
        list: looks
          .map(
            (x) =>
              '<button class="link" data-open="' +
              x +
              '"><span style="font-family:var(--kana);font-size:18px">' +
              x +
              '</span> (' +
              rom(x) +
              ')</button>',
          )
          .join(t('or')),
      }) +
      '</p>';
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
        big: { ゃ: 'や', ゅ: 'ゆ', ょ: 'よ' }[parts[1]],
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
  const root = $('#sheetRoot');
  root.classList.toggle('swap', replacing);
  root.innerHTML = h;
  bindSay(root);
  let svg = null;
  if (!combo) {
    svg = strokeSVG(k, { guide: true });
    if (svg) $('[data-slot="0"]', root).appendChild(svg);
  }
  const pl = $('#shPlay', root);
  if (pl && svg) pl.onclick = () => svg.play();
  $('#shSay', root).onclick = () => {
    if (!speakFull(k)) $('#shSay', root).textContent = t('noSpeech');
  };
  $('#shWrite', root).onclick = () => {
    ui.writeK = parts[0];
    ui.writeGroup = groupOf(ui.writeK);
    const had = closeSheet('nav');
    showTab('write', { replace: had });
  };
  $$('[data-close]', root).forEach((b) => (b.onclick = () => closeSheet()));
  markSheetOpen();
  (pl || $('#shSay', root)).focus({ preventScroll: true });
  if (svg) setTimeout(() => svg.play(), 250);
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-open]');
  if (t) {
    e.preventDefault();
    openSheet(t.dataset.open);
  }
});
