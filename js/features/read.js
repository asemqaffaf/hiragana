import {flash, speak} from '../core/audio.js';
import {curDay, dayNumber} from '../core/plan.js';
import {ui} from '../core/ui-state.js';
import {SENTENCES, WORDS} from '../data/content.js';
import {DAILY_ALL} from '../data/daily.js';
import {dailyCard, dailyFor, dailySoFar} from './daily.js';
import {t} from '../i18n/core.js';
import {meanOf, wtitleOf} from '../i18n/helpers.js';
import {$, SPEAK_SVG} from '../util.js';

export function wordCard(w, cls) {
  return '<div class="word' + (cls || '') + '" role="button" tabindex="0" data-word><span class="kana" dir="ltr">' + w[0] + '</span><span class="ro" dir="ltr">' + w[1] + '</span><span class="mean">' + meanOf(w) + '</span><button class="say" data-say="' + w[0] + '" aria-label="' + t('read.hear', {w: w[0]}) + '">' + SPEAK_SVG + '</button></div>';
}
export function renderRead() {
  const n = dayNumber();
  let h = '<h2>' + t('tab.read') + '</h2><p class="muted">' + t('read.intro') + '</p>';
  h += '<div class="toggles" style="justify-content:flex-start"><label><input type="checkbox" id="rRo"' + (ui.showRo ? ' checked' : '') + '> ' + t('read.showRo') + '</label><label><input type="checkbox" id="rMean"' + (ui.showMean ? ' checked' : '') + '> ' + t('read.showMean') + '</label></div>';
  h += '<details class="rules"' + (n >= 10 ? ' open' : '') + '><summary>' + t('read.rulesTitle') + '</summary>' + t('read.rules').map(x => '<p>' + x + '</p>').join('') + '</details>';
  const todayW = dailyFor(curDay()), soFar = dailySoFar(), later = DAILY_ALL.length - soFar.length - todayW.length;
  h += '<h3>' + t('daily.title') + ' <span class="muted small">' + t('daily.today', {d: curDay()}) + '</span></h3><div class="dlist">' + todayW.map(dailyCard).join('') + '</div>';
  if (soFar.length) h += '<details class="fold"><summary>' + t('daily.sofar', {n: soFar.length}) + '</summary><div class="dlist">' + soFar.map(dailyCard).join('') + '</div></details>';
  if (later > 0) h += '<p class="small muted">' + t('daily.later', {n: later}) + '</p>';
  WORDS.forEach(g => {
    h += '<h3>' + wtitleOf(g) + ' <span class="muted small">' + t('read.from', {d: g.from, notYet: n >= 1 && n < g.from}) + '</span></h3><div class="words">' + g.items.map(w => wordCard(w)).join('') + '</div>';
  });
  h += '<h3>' + t('read.sentences') + ' <span class="muted small">' + t('read.day12') + '</span></h3><div class="sentences">' + SENTENCES.map(w => wordCard(w)).join('') + '</div>';
  const root = $('#tab-read');
  root.innerHTML = h;
  root.classList.toggle('show-ro', ui.showRo); root.classList.toggle('show-mean', ui.showMean);
  $('#rRo', root).onchange = e => { ui.showRo = e.target.checked; root.classList.toggle('show-ro', ui.showRo); };
  $('#rMean', root).onchange = e => { ui.showMean = e.target.checked; root.classList.toggle('show-mean', ui.showMean); };
  root.onclick = e => {
    const db = e.target.closest('[data-dw]');
    if (db) { speak(db.dataset.dw + '|dw'); return; }
    const sb = e.target.closest('[data-say]');
    if (sb) { e.stopPropagation(); speak(sb.dataset.say); return; }
    const c = e.target.closest('[data-word]');
    if (c) { c.classList.toggle('open'); const w = $('[data-say]', c); if (w) { speak(w.dataset.say); flash(c); } }
  };
  root.onkeydown = e => { const c = e.target.closest('[data-word]'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); c.classList.toggle('open'); } };
}
