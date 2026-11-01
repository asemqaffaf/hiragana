import { flash, speak } from '../core/audio.js';
import { replay } from '../core/motion.js';
import { showTab } from '../core/nav.js';
import { sectionsFor } from '../core/goals.js';
import { curDay, goalOf } from '../core/plan.js';
import { dailyFor } from '../core/daily.js';
import { ui } from '../core/ui-state.js';
import { WORDS } from '../data/content.js';
import { DAILY_ALL, EXTRA, PHRASES } from '../data/daily.js';
import { completeLessonWords, lesson, recordLessonWord } from '../core/lesson.js';
import { wordCard } from '../ui/word-card.js';
import { dailyCard } from '../ui/daily-card.js';
import { t } from '../i18n/core.js';
import { meanOf, phraseTitle } from '../i18n/helpers.js';
import { $ } from '../util.js';

/* ---------- daily words and phrases ---------- */
function hearDaily(k) {
  speak(k + '|dw');
  if (ui.currentTab === 'daily') recordLessonWord(k);
}
export function renderDaily() {
  const list = dailyFor(curDay());
  const x = lesson(),
    heard = list.filter((w) => x.d.includes(w[0])).length;
  let h = '<h2>' + t('tab.daily') + '</h2><p class="muted">' + t('daily.intro') + '</p>';
  h +=
    '<div class="meettop"><span class="small muted" id="dHeard">' +
    t('daily.heard', { n: heard, m: list.length }) +
    '</span><div class="rbar"><i style="width:' +
    Math.round((heard / Math.max(1, list.length)) * 100) +
    '%"></i></div></div>';
  h += '<div class="dlist">' + list.map(dailyCard).join('') + '</div>';
  h +=
    '<div class="btnrow meetnav actionbar"><button class="btn primary" id="dDone">' +
    t('daily.done') +
    '</button></div>';
  const root = $('#tab-daily');
  root.innerHTML = h;
  root.onclick = (e) => {
    const card = e.target.closest('.dcard'),
      b = e.target.closest('[data-dw]') || (card && $('[data-dw]', card));
    if (b) {
      flash(card);
      hearDaily(b.dataset.dw);
      b.closest('.dcard').classList.add('heard');
      const y = lesson(),
        n = list.filter((w) => y.d.includes(w[0])).length;
      $('#dHeard', root).textContent = t('daily.heard', { n, m: list.length });
      $('.rbar i', root).style.width = Math.round((n / list.length) * 100) + '%';
    }
  };
  list.forEach((w, i) => {
    if (x.d.includes(w[0])) root.querySelectorAll('.dcard')[i].classList.add('heard');
  });
  $('#dDone', root).onclick = () => {
    completeLessonWords();
    showTab('plan');
  };
}
export function renderPhrases() {
  const k = ui.phFilter;
  let h = '<h2>' + t('tab.phrases') + '</h2>';
  if (k) {
    /* opened from the Write page: only what uses this letter */
    const hits = PHRASES.map((g) => ({ g, items: g.items.filter((p) => p[0].includes(k)) })).filter(
      (x) => x.items.length,
    );
    const nHit = hits.reduce((s, x) => s + x.items.length, 0);
    const seen = new Set(),
      pool = [];
    if (!nHit) {
      /* no phrase uses it yet: fall back to the words that do */
      const add = (kana, ro, mean) => {
        if (kana.includes(k) && !seen.has(kana)) {
          seen.add(kana);
          pool.push([kana, ro, mean]);
        }
      };
      WORDS.forEach((g) => g.items.forEach((w) => add(w[0], w[1], meanOf(w))));
      DAILY_ALL.forEach((w) => add(w[0], w[1], meanOf(w, 'dailyMeanings')));
      Object.keys(EXTRA).forEach((x) =>
        EXTRA[x].forEach((w) => add(w[0], w[1], meanOf(w, 'extraMeanings'))),
      );
    }
    h +=
      '<div class="phfilter"><span class="kana" dir="ltr">' +
      k +
      '</span><span class="phft">' +
      t(nHit ? 'ph.with' : pool.length ? 'ph.noneFor' : 'ph.nothing', { k }) +
      '</span><button class="btn" id="phAll" type="button">' +
      t('ph.all') +
      '</button></div>';
    if (nHit) {
      hits.forEach((x) => {
        h +=
          '<h3>' +
          phraseTitle(x.g) +
          ' <span class="muted small">' +
          t('ph.count', { n: x.items.length }) +
          '</span></h3><div class="sentences phr">' +
          x.items.map((p) => wordCard(p, ' open', meanOf(p, 'phraseMeanings'))).join('') +
          '</div>';
      });
    } else if (pool.length)
      h +=
        '<div class="sentences phr">' +
        pool.map((w) => wordCard(w, ' open', w[2])).join('') +
        '</div>';
  } else {
    /* showing everything, but we know which letter the user came from: one tap goes back to it */
    if (ui.phLetter)
      h +=
        '<div class="phfilter all"><span class="kana" dir="ltr">' +
        ui.phLetter +
        '</span><span class="phft">' +
        t('ph.showingAll') +
        '</span><button class="btn primary" id="phOnly" type="button">' +
        t('ph.only', { k: ui.phLetter }) +
        '</button></div>';
    h += '<p class="muted">' + t('ph.intro') + '</p>';
    /* the person's goal decides which sections open first; "Everything" shows all of them with no bar */
    const reason = goalOf().reason,
      mine = sectionsFor(reason, PHRASES),
      scoped = reason !== 'all' && ui.phScope !== 'all';
    if (reason !== 'all')
      h +=
        '<div class="phfilter goalbar' +
        (scoped ? '' : ' all') +
        '"><span class="phft">' +
        t(scoped ? 'ph.goalBar' : 'ph.goalBarAll', {
          n: mine.length,
          m: PHRASES.length,
          goal: t('goal.reason.' + reason),
        }) +
        '</span><button class="btn' +
        (scoped ? '' : ' primary') +
        '" id="phScope" type="button">' +
        t(scoped ? 'ph.showAllSec' : 'ph.showMine') +
        '</button></div>';
    (scoped ? mine : PHRASES).forEach((g) => {
      h +=
        '<h3>' +
        phraseTitle(g) +
        (reason !== 'all' && !scoped && mine.includes(g)
          ? ' <span class="tag now">' + t('ph.forGoal') + '</span>'
          : '') +
        ' <span class="muted small">' +
        t('ph.count', { n: g.items.length }) +
        '</span></h3><div class="sentences phr">' +
        g.items.map((p) => wordCard(p, ' open', meanOf(p, 'phraseMeanings'))).join('') +
        '</div>';
    });
  }
  const root = $('#tab-phrases');
  root.innerHTML = h;
  const all = $('#phAll', root);
  if (all)
    all.onclick = () => {
      ui.phFilter = null;
      renderPhrases();
      window.scrollTo(0, 0);
      replay($('.phfilter', root), 'swap');
    };
  const sc = $('#phScope', root);
  if (sc)
    sc.onclick = () => {
      ui.phScope = ui.phScope === 'all' ? 'goal' : 'all';
      renderPhrases();
      window.scrollTo(0, 0);
      replay($('.phfilter', root), 'swap');
    };
  const only = $('#phOnly', root);
  if (only)
    only.onclick = () => {
      ui.phFilter = ui.phLetter;
      renderPhrases();
      window.scrollTo(0, 0);
      replay($('.phfilter', root), 'swap');
    };
  root.onclick = (e) => {
    const c = e.target.closest('[data-word]'),
      sb = e.target.closest('[data-say]') || (c && $('[data-say]', c));
    if (sb) {
      e.stopPropagation();
      speak(sb.dataset.say);
      flash(c || sb.closest('.word'));
    }
  };
}
