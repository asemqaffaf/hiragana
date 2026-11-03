import { flash, speak } from '../core/audio.js';
import { replay } from '../core/motion.js';
import { curDay, dayNumber } from '../core/plan.js';
import { ui } from '../core/ui-state.js';
import { EXAMPLES, SENTENCES, WORDS } from '../data/content.js';
import { DAILY_ALL, EXTRA } from '../data/daily.js';
import { dailyFor, dailySoFar } from '../core/daily.js';
import { dailyCard } from '../ui/daily-card.js';
import { wordCard } from '../ui/word-card.js';
import { bindPracticeNext } from '../ui/practice-next.js';
import { t, tList } from '../i18n/core.js';
import { exampleMeaning, meanOf, wtitleOf } from '../i18n/helpers.js';
import { $, closest, must } from '../util.js';

/* Everything the Words page can show for one letter: the letter's own example words, the reading-list words, the daily words (with their
   example sentence) and the reading sentences that use it. Each word appears once. */
/** @param {string} k */
export function wordsWith(k) {
  const daily = DAILY_ALL.filter((w) => w[0].includes(k)),
    seen = new Set(daily.map((w) => w[0]));
  /** @type {import('../../types/app').Word[]} */
  const plain = [];
  /** @param {string} kana @param {string} ro @param {string} mean */
  const add = (kana, ro, mean) => {
    if (kana.includes(k) && !seen.has(kana)) {
      seen.add(kana);
      plain.push([kana, ro, mean]);
    }
  };
  /** @param {readonly string[]} w */
  const pick = (w) => meanOf(w, 'extraMeanings');
  if (EXAMPLES[k]) add(EXAMPLES[k][0], EXAMPLES[k][1], exampleMeaning(k));
  (EXTRA[k] || []).forEach((w) => add(w[0], w[1], pick(w)));
  Object.keys(EXTRA).forEach((x) => EXTRA[x].forEach((w) => add(w[0], w[1], pick(w))));
  WORDS.forEach((g) => g.items.forEach((w) => add(w[0], w[1], meanOf(w))));
  /* words that start with the letter first */
  plain.sort((a, b) => Number(b[0].startsWith(k)) - Number(a[0].startsWith(k)));
  return { daily, plain, sentences: SENTENCES.filter((s) => s[0].includes(k)) };
}
/** @param {string} k */
function renderWordsFor(k) {
  const { daily, plain, sentences } = wordsWith(k),
    n = daily.length + plain.length;
  let h = '<h2>' + t('tab.read') + '</h2>';
  h +=
    '<div class="phfilter"><span class="kana" dir="ltr">' +
    k +
    '</span><span class="phft">' +
    t(n ? 'rd.with' : sentences.length ? 'rd.noneFor' : 'rd.nothing', { k }) +
    '</span><button class="btn" id="rdAll" type="button">' +
    t('rd.all') +
    '</button></div>';
  if (plain.length)
    h +=
      '<h3>' +
      t('rd.words') +
      '</h3><div class="words">' +
      plain.map((w) => wordCard(w, ' open', w[2])).join('') +
      '</div>';
  if (daily.length)
    h +=
      '<h3>' +
      t('daily.title') +
      '</h3><div class="dlist">' +
      daily.map(dailyCard).join('') +
      '</div>';
  if (sentences.length)
    h +=
      '<h3>' +
      t('read.sentences') +
      '</h3><div class="sentences">' +
      sentences.map((w) => wordCard(w, ' open')).join('') +
      '</div>';
  return h;
}
/** @param {number} n today's day number */
function allWordsHtml(n) {
  let h = '<h2>' + t('tab.read') + '</h2>';
  /* we know which letter the student came from: one tap goes back to it */
  if (ui.rdLetter)
    h +=
      '<div class="phfilter all"><span class="kana" dir="ltr">' +
      ui.rdLetter +
      '</span><span class="phft">' +
      t('rd.showingAll') +
      '</span><button class="btn primary" id="rdOnly" type="button">' +
      t('rd.only', { k: ui.rdLetter }) +
      '</button></div>';
  h += '<p class="muted">' + t('read.intro') + '</p>';
  h +=
    '<div class="toggles"><label><input type="checkbox" id="rRo" role="switch"' +
    (ui.showRo ? ' checked' : '') +
    '> ' +
    t('read.showRo') +
    '</label><label><input type="checkbox" role="switch" id="rMean"' +
    (ui.showMean ? ' checked' : '') +
    '> ' +
    t('read.showMean') +
    '</label></div>';
  h +=
    '<details class="rules"' +
    (n >= 10 ? ' open' : '') +
    '><summary>' +
    t('read.rulesTitle') +
    '</summary>' +
    tList('read.rules')
      .map((x) => '<p>' + x + '</p>')
      .join('') +
    '</details>';
  const todayW = dailyFor(curDay()),
    soFar = dailySoFar(),
    later = DAILY_ALL.length - soFar.length - todayW.length;
  h +=
    '<h3>' +
    t('daily.title') +
    ' <span class="muted small">' +
    t('daily.today', { d: curDay() }) +
    '</span></h3><div class="dlist">' +
    todayW.map(dailyCard).join('') +
    '</div>';
  if (soFar.length)
    h +=
      '<details class="fold"><summary>' +
      t('daily.sofar', { n: soFar.length }) +
      '</summary><div class="dlist">' +
      soFar.map(dailyCard).join('') +
      '</div></details>';
  if (later > 0) h += '<p class="small muted">' + t('daily.later', { n: later }) + '</p>';
  WORDS.forEach((g) => {
    h +=
      '<h3>' +
      wtitleOf(g) +
      ' <span class="muted small">' +
      t('read.from', { d: g.from, notYet: n >= 1 && n < g.from }) +
      '</span></h3><div class="words">' +
      g.items.map((w) => wordCard(w)).join('') +
      '</div>';
  });
  h +=
    '<h3>' +
    t('read.sentences') +
    ' <span class="muted small">' +
    t('read.day12') +
    '</span></h3><div class="sentences">' +
    SENTENCES.map((w) => wordCard(w)).join('') +
    '</div>';
  return h;
}
export function renderRead() {
  const k = ui.rdFilter,
    root = must('#tab-read');
  root.innerHTML = k ? renderWordsFor(k) : allWordsHtml(dayNumber());
  bindPracticeNext(root, 'read');
  /* filtered pages always show romaji and meaning, so the checkboxes and the tap-to-open toggle only apply to the full list */
  root.classList.toggle('show-ro', !k && ui.showRo);
  root.classList.toggle('show-mean', !k && ui.showMean);
  /** @param {() => string | null} filter */
  const swap = (filter) => () => {
    ui.rdFilter = filter();
    renderRead();
    window.scrollTo(0, 0);
    replay($('.phfilter', root), 'swap');
  };
  const all = $('#rdAll', root);
  if (all) all.onclick = swap(() => null);
  const only = $('#rdOnly', root);
  if (only) only.onclick = swap(() => ui.rdLetter);
  if (!k) {
    const ro = must('#rRo', root, HTMLInputElement),
      mean = must('#rMean', root, HTMLInputElement);
    ro.onchange = () => {
      ui.showRo = ro.checked;
      root.classList.toggle('show-ro', ui.showRo);
    };
    mean.onchange = () => {
      ui.showMean = mean.checked;
      root.classList.toggle('show-mean', ui.showMean);
    };
  }
  root.onclick = (e) => {
    const db = closest(e, '[data-dw]');
    if (db) {
      speak(db.dataset.dw + '|dw');
      return;
    }
    const sb = closest(e, '[data-say]');
    if (sb) {
      e.stopPropagation();
      speak(sb.dataset.say || '');
      return;
    }
    const c = closest(e, '[data-word]');
    if (c) {
      if (!k) c.classList.toggle('open');
      const w = $('[data-say]', c);
      if (w) {
        speak(w.dataset.say || '');
        flash(c);
      }
    }
  };
  root.onkeydown = (e) => {
    const c = closest(e, '[data-word]');
    if (c && !k && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      c.classList.toggle('open');
    }
  };
}
