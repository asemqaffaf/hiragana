import { speak } from '../core/audio.js';
import { replay } from '../core/motion.js';
import { showTab } from '../core/nav.js';
import { PLEN, curDay, dayNumber, soFarPool, todayPool, weakPool } from '../core/plan.js';
import { weight } from '../core/stats.js';
import { state } from '../core/store.js';
import { recordAnswer, recordRound, setDayComplete } from '../core/progress.js';
import { ui } from '../core/ui-state.js';
import {
  A46,
  ALL,
  DAK25,
  DROWS,
  LOOK,
  LOOKSET,
  NOSOUNDQ,
  R,
  ROWS,
  YOON33,
  kanaOf,
  rom,
} from '../data/letters.js';
import { recordLessonQuiz } from '../core/lesson.js';
import { kb } from '../ui/letter-button.js';
import { K, t } from '../i18n/core.js';
import { explain } from '../i18n/helpers.js';
import { $, $$, MARK_SVG, SPEAK_SVG, must, reduceMotion, shuffle } from '../util.js';

/** @type {readonly import('../../types/app').DrillMode[]} */
const DRILL_MODES = ['read', 'choose', 'listen'];
/** @type {readonly (number | 'all')[]} */
const DRILL_LENGTHS = [10, 20, 40, 'all'];

/** The letter whose romaji was typed, if any. @param {string} v @returns {string | null} */
const romToKana = (v) => {
  const n = norm(v);
  return (n && ALL.find((x) => R[x].includes(n))) || null;
};
/** A set of letters to drill: a named preset, or one row. @typedef {{id: string, lk?: import('../../types/app').TextKey, k?: string, get: () => string[]}} Preset */
/** @type {Preset[]} */
const PRESETS = [
  { id: 'today', lk: 'pre.today', get: todayPool },
  { id: 'sofar', lk: 'pre.sofar', get: soFarPool },
  { id: 'weak', lk: 'pre.weak', get: weakPool },
  { id: 'look', lk: 'pre.look', get: () => LOOKSET },
  { id: 'a46', lk: 'pre.a46', get: () => A46 },
  { id: 'dak', lk: 'pre.dak', get: () => DAK25 },
  { id: 'yoon', lk: 'pre.yoon', get: () => YOON33 },
  { id: 'all', lk: 'pre.all', get: () => ALL },
];
/** @type {Preset[]} */
const ROWPRESETS = [...ROWS, ...DROWS].map((r) => ({
  id: 'row-' + r.id,
  k: kanaOf(r)[0],
  get: () => kanaOf(r),
}));
/** @param {Preset} p */
const presetLabel = (p) => (p.lk ? t(p.lk) : t('pre.row', { k: K(p.k ?? '') }));
/** The letters selected for a new round, in chart order. */
function drillPool() {
  /** @type {string[]} */
  let out = [];
  [...PRESETS, ...ROWPRESETS].forEach((p) => {
    if (ui.drillSel.has(p.id)) out = out.concat(p.get());
  });
  out = ALL.filter((k) => out.includes(k));
  if (ui.drillMode !== 'read') out = out.filter((k) => !NOSOUNDQ.includes(k));
  return out;
}
/** Draws `n` letters without repeats, favouring the ones that need practice. @param {string[]} pool @param {number} n */
function wsample(pool, n) {
  const arr = pool.slice();
  /** @type {string[]} */
  const out = [];
  while (out.length < n && arr.length) {
    const tot = arr.reduce((a, k) => a + weight(k), 0);
    let r = Math.random() * tot,
      i = 0;
    for (; i < arr.length; i++) {
      r -= weight(arr[i]);
      if (r <= 0) break;
    }
    out.push(arr.splice(Math.min(i, arr.length - 1), 1)[0]);
  }
  return out;
}
/** @param {string[]} pool @param {number} n @returns {import('../../types/app').DrillQuestion[]} */
function buildSeq(pool, n) {
  /** @type {string[]} */
  let seq;
  if (n <= pool.length) seq = wsample(pool, n);
  else {
    seq = shuffle(pool.slice());
    let guard = 0;
    while (seq.length < n && guard++ < 1000) {
      const k = wsample(pool, 1)[0];
      if (pool.length === 1 || k !== seq[seq.length - 1]) seq.push(k);
    }
  }
  return seq.map((k) => ({ k, retry: false }));
}
export function renderDrill() {
  const root = must('#tab-drill');
  if (!ui.session) return renderSetup(root);
  if (ui.session.done) return renderResults(root, ui.session);
  renderQuestion(root, ui.session);
}
/** @param {HTMLElement} root */
function renderSetup(root) {
  const pool = drillPool();
  const n = ui.drillLen === 'all' ? pool.length : ui.drillLen;
  const weakEmpty = ui.drillSel.has('weak') && weakPool().length === 0;
  let h = '<h2>' + t('tab.drill') + '</h2><p class="muted">' + t('drill.intro') + '</p>';
  h +=
    '<div class="chips">' +
    PRESETS.map(
      (p) =>
        '<button class="chip" data-sel="' +
        p.id +
        '" aria-pressed="' +
        ui.drillSel.has(p.id) +
        '">' +
        presetLabel(p) +
        '</button>',
    ).join('') +
    '</div>';
  h +=
    '<details class="more"' +
    (ROWPRESETS.some((p) => ui.drillSel.has(p.id)) ? ' open' : '') +
    '><summary>' +
    t('drill.rows') +
    '</summary><div class="chips">' +
    ROWPRESETS.map(
      (p) =>
        '<button class="chip" data-sel="' +
        p.id +
        '" aria-pressed="' +
        ui.drillSel.has(p.id) +
        '">' +
        presetLabel(p) +
        '</button>',
    ).join('') +
    '</div></details>';
  h += '<h3>' + t('drill.how') + '</h3><div class="modes">';
  h += DRILL_MODES
    .map(
      (id) =>
        '<button class="mode" data-mode="' +
        id +
        '" aria-pressed="' +
        (ui.drillMode === id) +
        '"><b>' +
        t(`mode.${id}`) +
        '</b><span>' +
        t(`mode.${id}D`) +
        '</span></button>',
    )
    .join('');
  h +=
    '</div><h3>' +
    t('drill.questions') +
    '</h3><div class="seg" role="group" aria-label="' +
    t('drill.questions') +
    '">' +
    DRILL_LENGTHS
      .map(
        (x) =>
          '<button data-len="' +
          x +
          '" aria-pressed="' +
          (ui.drillLen === x) +
          '">' +
          (x === 'all' ? t('all') : x) +
          '</button>',
      )
      .join('') +
    '</div>';
  if (weakEmpty) h += '<p class="note">' + t('drill.weakEmpty') + '</p>';
  h +=
    '<div class="btnrow"><button class="btn primary" id="startDrill"' +
    (pool.length ? '' : ' disabled') +
    '>' +
    (pool.length ? t('drill.start', { n, p: pool.length }) : t('drill.pick')) +
    '</button></div>';
  root.innerHTML = h;
  $$('[data-sel]', root).forEach(
    (b) =>
      (b.onclick = () => {
        const id = b.dataset.sel;
        if (!id) return;
        if (ui.drillSel.has(id)) ui.drillSel.delete(id);
        else ui.drillSel.add(id);
        renderSetup(root);
      }),
  );
  $$('[data-mode]', root).forEach(
    (b) =>
      (b.onclick = () => {
        const mode = DRILL_MODES.find((m) => m === b.dataset.mode);
        if (mode) ui.drillMode = mode;
        renderSetup(root);
      }),
  );
  $$('[data-len]', root).forEach(
    (b) =>
      (b.onclick = () => {
        ui.drillLen = b.dataset.len === 'all' ? 'all' : Number(b.dataset.len);
        renderSetup(root);
      }),
  );
  must('#startDrill', root).onclick = () => startDrill(pool);
}
/** Starts a round over some letters. @param {string[]} pool */
export function startDrill(pool) {
  if (!pool.length) return;
  const n = ui.drillLen === 'all' ? pool.length : ui.drillLen;
  ui.session = {
    pool,
    src: 'sel',
    mode: ui.drillMode,
    seq: buildSeq(pool, n),
    i: 0,
    results: [],
    misses: [],
    built: false,
    locked: false,
    t0: 0,
  };
  presentQuestion();
}
function presentQuestion() {
  renderDrill();
  const session = ui.session;
  if (session && !session.done && session.mode === 'listen') speak(session.seq[session.i].k);
}
/** The progress bar above a question. @param {import('../../types/app').DrillSession} s */
function qTop(s) {
  const answered = s.results.length,
    total = s.seq.filter((x) => !x.retry).length;
  const lbl =
    s.seq[s.i] && s.seq[s.i].retry ? t('q.retry') : Math.min(answered + 1, total) + ' / ' + total;
  return (
    '<div class="qtop"><button class="link" id="qEnd">' +
    t('q.end') +
    '</button><div class="bar"><i style="width:' +
    (s.i / s.seq.length) * 100 +
    '%"></i></div><span class="count">' +
    lbl +
    '</span></div>'
  );
}
/** @param {HTMLElement} root @param {import('../../types/app').DrillSession} s */
function renderQuestion(root, s) {
  const item = s.seq[s.i],
    k = item.k;
  s.locked = false;
  if (s.mode === 'read') {
    if (!s.built) {
      root.innerHTML =
        '<div id="qtopWrap"></div><div class="sq qsq" id="qsq"><span class="k" id="qk"></span>' +
        MARK_SVG +
        '</div><div class="flash" id="qflash" aria-live="polite"></div><div class="answer"><input id="qin" type="text" dir="ltr" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" aria-label="' +
        t('q.inputLabel') +
        '" placeholder="' +
        t('q.placeholder') +
        '"><div class="btnrow"><button class="btn" id="qGive">' +
        t('q.show') +
        '</button><button class="btn primary" id="qCheck">' +
        t('q.check') +
        '</button></div></div><div id="qfb"></div>';
      s.built = true;
      const inp = must('#qin', root, HTMLInputElement);
      const autoCheck = () => {
        if (s.locked || !ui.session || ui.session !== s) return;
        if (isRight(s.seq[s.i].k, inp.value)) answer(s, true, inp.value);
      };
      inp.addEventListener('input', (e) => {
        if (e instanceof InputEvent && e.isComposing) return;
        autoCheck();
      });
      inp.addEventListener('compositionend', autoCheck);
      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
        e.preventDefault();
        if (s.locked) {
          const nb = $('#qNext', root);
          if (nb) nb.click();
          return;
        }
        if (inp.value.trim()) answer(s, isRight(s.seq[s.i].k, inp.value), inp.value);
      });
      must('#qCheck', root).onclick = () => {
        if (s.locked) return;
        const v = inp.value;
        if (!v.trim()) {
          inp.focus();
          return;
        }
        answer(s, isRight(s.seq[s.i].k, v), v);
      };
      must('#qGive', root).onclick = () => {
        if (!s.locked) answer(s, false, '');
      };
    }
    must('#qtopWrap', root).innerHTML = qTop(s);
    must('#qEnd', root).onclick = endSession;
    const qsq = must('#qsq', root);
    const isTwo = k.length === 2;
    must('#qk', root).textContent = k;
    replay(must('#qk', root), 'flip');
    qsq.classList.toggle('yo', isTwo);
    must('.mark', qsq, SVGElement).setAttribute('class', 'mark');
    must('#qflash', root).textContent = '';
    must('#qfb', root).innerHTML = '';
    const inp = must('#qin', root, HTMLInputElement);
    inp.value = '';
    inp.disabled = false;
    must('#qCheck', root, HTMLButtonElement).disabled = false;
    must('#qGive', root, HTMLButtonElement).disabled = false;
    if (document.activeElement !== inp && !matchMedia('(pointer: coarse)').matches) inp.focus();
    s.t0 = performance.now();
    return;
  }
  s.built = false;
  const choices = shuffle([k, ...distractors(k, 3, s.pool)]);
  let h = qTop(s);
  if (s.mode === 'choose') h += '<div class="prompt">' + rom(k) + '</div>';
  else
    h +=
      '<button class="bigsay" id="qPlay" aria-label="' +
      t('q.again') +
      '">' +
      SPEAK_SVG +
      '</button>';
  h +=
    '<div class="choices">' +
    choices
      .map(
        (c) =>
          '<button class="sq" data-pick="' +
          c +
          '"><span class="k">' +
          c +
          '</span>' +
          MARK_SVG +
          '</button>',
      )
      .join('') +
    '</div><div id="qfb"></div>';
  root.innerHTML = h;
  must('#qEnd', root).onclick = endSession;
  $$('[data-pick]', root).forEach(
    (b) =>
      (b.onclick = () => {
        if (!s.locked && b.dataset.pick) answer(s, b.dataset.pick === k, b.dataset.pick, b);
      }),
  );
  if (s.mode === 'listen') must('#qPlay', root).onclick = () => speak(k);
  s.t0 = performance.now();
}
/** Lowercase letters only: what a typed romaji answer is compared on. @param {string} [v] */
function norm(v) {
  return (v || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}
/** @param {string} s */
const toHira = (s) =>
  s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
/** Other letters that are read the same, accepted when typed as kana. @type {Record<string, string[]>} */
const KANA_ALT = { を: ['お'], ぢ: ['じ'], づ: ['ず'] };
/** Whether a typed answer (romaji or kana) is right for a letter. @param {string} k @param {string} v */
function isRight(k, v) {
  const n = norm(v);
  if (n && R[k].includes(n)) return true;
  const h = toHira((v || '').normalize('NFKC').replace(/\s/g, ''));
  return h === k || (KANA_ALT[k] || []).includes(h);
}
/** Wrong choices for a multiple-choice question: look-alikes first, then letters from the same group. @param {string} k @param {number} n @param {string[]} pool */
function distractors(k, n, pool) {
  /** @type {string[]} */
  const out = [];
  /** @param {string} x */
  const bad = (x) =>
    !x || x === k || out.includes(x) || NOSOUNDQ.includes(x) || !R[x] || R[x][0] === R[k][0];
  /** @param {string} x */
  const push = (x) => {
    if (!bad(x)) out.push(x);
  };
  shuffle((LOOK[k] || []).slice())
    .slice(0, 2)
    .forEach(push);
  const cat = k.length === 2 ? YOON33 : DAK25.includes(k) ? DAK25.concat(A46) : A46;
  shuffle(pool.slice()).forEach((x) => {
    if (out.length < n) push(x);
  });
  shuffle(cat.slice()).forEach((x) => {
    if (out.length < n) push(x);
  });
  return out.slice(0, n);
}
/**
 * Records an answer and shows the feedback.
 * @param {import('../../types/app').DrillSession} s
 * @param {boolean} ok
 * @param {string} given what was typed or picked
 * @param {HTMLElement} [btn] the picked choice, in the multiple-choice modes
 */
function answer(s, ok, given, btn) {
  const item = s.seq[s.i],
    k = item.k,
    root = must('#tab-drill');
  s.locked = true;
  const ms = performance.now() - s.t0;
  recordAnswer(k, ok, ms, s.mode === 'read' ? romToKana(given) : given);
  if (!item.retry) s.results.push({ k, ok, ms });
  if (!ok) {
    if (!s.misses.includes(k)) s.misses.push(k);
    const ahead = s.seq.slice(s.i + 1, s.i + 4).some((x) => x.k === k);
    if (!ahead) s.seq.splice(Math.min(s.i + 3, s.seq.length), 0, { k, retry: true });
  }
  if (s.mode === 'read') {
    const mark = must('#qsq .mark', root, SVGElement);
    mark.setAttribute('class', 'mark ' + (ok ? 'ok' : 'no'));
    if (ok) {
      must('#qflash', root).textContent = rom(k);
      setTimeout(nextQ, reduceMotion ? 450 : 700);
      return;
    }
    must('#qin', root, HTMLInputElement).disabled = true;
    must('#qCheck', root, HTMLButtonElement).disabled = true;
    must('#qGive', root, HTMLButtonElement).disabled = true;
  } else if (btn) {
    const correctBtn = must('[data-pick="' + k + '"]', root);
    if (ok) {
      must('.mark', btn, SVGElement).setAttribute('class', 'mark ok');
      if (s.mode === 'choose') speak(k);
      setTimeout(nextQ, reduceMotion ? 450 : 750);
      return;
    }
    must('.mark', btn, SVGElement).setAttribute('class', 'mark no');
    must('.mark', correctBtn, SVGElement).setAttribute('class', 'mark ok');
    speak(k);
  }
  const fb = must('#qfb', root);
  fb.innerHTML =
    '<div class="fb" role="status"><div class="ans">' +
    t('q.is', { k, r: rom(k) }) +
    '</div><p class="small" id="fbGiven"></p><p>' +
    explain(k) +
    '</p><button class="btn primary" id="qNext" style="width:100%">' +
    t('next') +
    '</button></div>';
  if (s.mode === 'read' && (given || '').trim())
    must('#fbGiven', fb).textContent = t('q.typed', { v: given.trim() });
  else if (s.mode !== 'read' && given)
    must('#fbGiven', fb).textContent = t('q.picked', { k: given, r: rom(given) });
  must('#qNext', fb).onclick = () => {
    nextQ();
    const inp = $('#qin');
    if (inp) inp.focus();
  };
  const nb = must('#qNext', fb);
  nb.focus({ preventScroll: true });
  nb.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
}
function nextQ() {
  const s = ui.session;
  if (!s || s.done) return;
  s.i++;
  if (s.i >= s.seq.length) {
    s.done = true;
    s.built = false;
    finishSession();
  }
  if (ui.currentTab === 'drill' && window.scrollY > 0) window.scrollTo(0, 0);
  presentQuestion();
}
function endSession() {
  if (!ui.session) return;
  if (ui.session.results.length) {
    ui.session.done = true;
    ui.session.built = false;
    finishSession();
  } else ui.session = null;
  renderDrill();
}
function finishSession() {
  const session = ui.session;
  if (!session || session.logged || !session.results.length) return;
  const percent = Math.round(
    (session.results.filter((result) => result.ok).length / session.results.length) * 100,
  );
  session.logged = true;
  recordRound(session.results.length, percent);
  if (ui.lessonQuiz) recordLessonQuiz(percent);
}

/** Begins a round over the letters of the last one that were missed, or over the same letters again. @param {import('../../types/app').DrillSession} s @param {string[]} pool */
function startMissRound(s, pool) {
  ui.session = {
    pool,
    src: 'miss',
    mode: s.mode,
    seq: buildSeq(pool, Math.max(pool.length * 3, 6)),
    i: 0,
    results: [],
    misses: [],
    built: false,
    locked: false,
    t0: 0,
  };
  presentQuestion();
}

/** @param {HTMLElement} root @param {import('../../types/app').DrillSession} s */
function renderResults(root, s) {
  const r = s.results;
  const right = r.filter((x) => x.ok).length,
    pct = r.length ? Math.round((right / r.length) * 100) : 0;
  const okTimes = r.filter((x) => x.ok).map((x) => x.ms);
  const avg = okTimes.length ? okTimes.reduce((a, b) => a + b, 0) / okTimes.length / 1000 : 0;
  const n = dayNumber(),
    day = curDay();
  let h =
    '<h2>' + t('res.title') + '</h2><div class="result">' + right + ' / ' + r.length + '</div>';
  h += '<p>' + t('res.pct', { pct, avg: okTimes.length ? avg.toFixed(1) : '' }) + '</p>';
  if (pct >= 90)
    h += '<p class="muted">' + t(r.length < 10 ? 'res.clearShort' : 'res.clear') + '</p>';
  else if (r.length) h += '<p class="muted">' + t('res.below') + '</p>';
  if (s.misses.length) {
    h +=
      '<h3>' +
      t('res.missed') +
      '</h3><div class="missed">' +
      s.misses.map((k) => kb(k)).join('') +
      '</div>';
  }
  h +=
    '<div class="btnrow">' +
    (s.misses.length
      ? '<button class="btn primary" id="rMiss">' + t('res.drillMisses') + '</button>'
      : '') +
    '<button class="btn' +
    (s.misses.length ? '' : ' primary') +
    '" id="rAgain">' +
    t('res.same') +
    '</button><button class="btn" id="rSetup">' +
    t('res.change') +
    '</button></div>';
  if (ui.lessonQuiz)
    h +=
      '<div class="btnrow"><button class="btn ' +
      (pct >= 90 ? 'primary' : '') +
      ' bigbtn" id="rToday">' +
      t('lesson.back') +
      '</button></div>';
  else if (pct >= 90 && r.length >= 10 && n >= 1 && n <= PLEN() && !state.done[day])
    h +=
      '<div class="btnrow"><button class="btn red" id="rDone">' +
      t('plan.markDone', { d: day }) +
      '</button></div>';
  root.innerHTML = h;
  const miss = $('#rMiss', root);
  if (miss) miss.onclick = () => startMissRound(s, s.misses.slice());
  must('#rAgain', root).onclick = () => {
    if (s.src === 'miss') {
      startMissRound(s, s.pool.slice());
      return;
    }
    const pool = drillPool();
    ui.session = null;
    startDrill(pool.length ? pool : s.pool);
  };
  must('#rSetup', root).onclick = () => {
    ui.session = null;
    ui.lessonQuiz = false;
    renderDrill();
  };
  const rt = $('#rToday', root);
  if (rt)
    rt.onclick = () => {
      ui.lessonQuiz = false;
      ui.session = null;
      showTab('plan');
    };
  const rd = $('#rDone', root, HTMLButtonElement);
  if (rd)
    rd.onclick = () => {
      setDayComplete(day, true);
      rd.textContent = t('plan.marked', { d: day });
      rd.disabled = true;
    };
}
