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
  rom,
} from '../data/letters.js';
import { recordLessonQuiz } from '../core/lesson.js';
import { kb } from '../ui/letter-button.js';
import { K, t } from '../i18n/core.js';
import { explain } from '../i18n/helpers.js';
import { $, $$, MARK_SVG, SPEAK_SVG, reduceMotion, shuffle } from '../util.js';

const romToKana = (v) => {
  const n = norm(v);
  return n ? ALL.find((x) => R[x].includes(n)) : null;
};
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
const ROWPRESETS = [...ROWS, ...DROWS].map((r) => ({
  id: 'row-' + r.id,
  k: r.kana[0],
  get: () => r.kana.filter(Boolean),
}));
const presetLabel = (p) => (p.lk ? t(p.lk) : t('pre.row', { k: K(p.k) }));
function drillPool() {
  let out = [];
  [...PRESETS, ...ROWPRESETS].forEach((p) => {
    if (ui.drillSel.has(p.id)) out = out.concat(p.get());
  });
  out = ALL.filter((k) => out.includes(k));
  if (ui.drillMode !== 'read') out = out.filter((k) => !NOSOUNDQ.includes(k));
  return out;
}
function wsample(pool, n) {
  const arr = pool.slice(),
    out = [];
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
function buildSeq(pool, n) {
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
  const root = $('#tab-drill');
  if (!ui.session) return renderSetup(root);
  if (ui.session.done) return renderResults(root);
  renderQuestion(root);
}
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
  h += ['read', 'choose', 'listen']
    .map(
      (id) =>
        '<button class="mode" data-mode="' +
        id +
        '" aria-pressed="' +
        (ui.drillMode === id) +
        '"><b>' +
        t('mode.' + id) +
        '</b><span>' +
        t('mode.' + id + 'D') +
        '</span></button>',
    )
    .join('');
  h +=
    '</div><h3>' +
    t('drill.questions') +
    '</h3><div class="seg" role="group" aria-label="' +
    t('drill.questions') +
    '">' +
    [10, 20, 40, 'all']
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
        if (ui.drillSel.has(id)) ui.drillSel.delete(id);
        else ui.drillSel.add(id);
        renderSetup(root);
      }),
  );
  $$('[data-mode]', root).forEach(
    (b) =>
      (b.onclick = () => {
        ui.drillMode = b.dataset.mode;
        renderSetup(root);
      }),
  );
  $$('[data-len]', root).forEach(
    (b) =>
      (b.onclick = () => {
        ui.drillLen = b.dataset.len === 'all' ? 'all' : +b.dataset.len;
        renderSetup(root);
      }),
  );
  $('#startDrill', root).onclick = () => startDrill(pool);
}
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
function qTop() {
  const s = ui.session;
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
function renderQuestion(root) {
  const s = ui.session,
    item = s.seq[s.i],
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
      const inp = $('#qin', root);
      const autoCheck = () => {
        if (s.locked || !ui.session || ui.session !== s) return;
        if (isRight(s.seq[s.i].k, inp.value)) answer(true, inp.value);
      };
      inp.addEventListener('input', (e) => {
        if (e.isComposing) return;
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
        if (inp.value.trim()) answer(isRight(s.seq[s.i].k, inp.value), inp.value);
      });
      $('#qCheck', root).onclick = () => {
        if (s.locked) return;
        const v = inp.value;
        if (!v.trim()) {
          inp.focus();
          return;
        }
        answer(isRight(s.seq[s.i].k, v), v);
      };
      $('#qGive', root).onclick = () => {
        if (!s.locked) answer(false, '');
      };
    }
    $('#qtopWrap', root).innerHTML = qTop();
    $('#qEnd', root).onclick = endSession;
    const qsq = $('#qsq', root);
    const isTwo = k.length === 2;
    $('#qk', root).textContent = k;
    replay($('#qk', root), 'flip');
    qsq.classList.toggle('yo', isTwo);
    $('.mark', qsq).setAttribute('class', 'mark');
    $('#qflash', root).textContent = '';
    $('#qfb', root).innerHTML = '';
    const inp = $('#qin', root);
    inp.value = '';
    inp.disabled = false;
    $('#qCheck', root).disabled = false;
    $('#qGive', root).disabled = false;
    if (document.activeElement !== inp && !matchMedia('(pointer: coarse)').matches) inp.focus();
    s.t0 = performance.now();
    return;
  }
  s.built = false;
  const choices = shuffle([k, ...distractors(k, 3, s.pool)]);
  let h = qTop();
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
  $('#qEnd', root).onclick = endSession;
  $$('[data-pick]', root).forEach(
    (b) =>
      (b.onclick = () => {
        if (!s.locked) answer(b.dataset.pick === k, b.dataset.pick, b);
      }),
  );
  if (s.mode === 'listen') $('#qPlay', root).onclick = () => speak(k);
  s.t0 = performance.now();
}
function norm(v) {
  return (v || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}
const toHira = (s) =>
  s.replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const KANA_ALT = { を: ['お'], ぢ: ['じ'], づ: ['ず'] };
function isRight(k, v) {
  const n = norm(v);
  if (n && R[k].includes(n)) return true;
  const h = toHira((v || '').normalize('NFKC').replace(/\s/g, ''));
  return h === k || (KANA_ALT[k] || []).includes(h);
}
function distractors(k, n, pool) {
  const out = [];
  const bad = (x) =>
    !x || x === k || out.includes(x) || NOSOUNDQ.includes(x) || !R[x] || R[x][0] === R[k][0];
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
function answer(ok, given, btn) {
  const s = ui.session,
    item = s.seq[s.i],
    k = item.k,
    root = $('#tab-drill');
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
    const mark = $('#qsq .mark', root);
    mark.setAttribute('class', 'mark ' + (ok ? 'ok' : 'no'));
    if (ok) {
      $('#qflash', root).textContent = rom(k);
      setTimeout(nextQ, reduceMotion ? 450 : 700);
      return;
    }
    $('#qin', root).disabled = true;
    $('#qCheck', root).disabled = true;
    $('#qGive', root).disabled = true;
  } else {
    const correctBtn = $('[data-pick="' + k + '"]', root);
    if (ok) {
      $('.mark', btn).setAttribute('class', 'mark ok');
      if (s.mode === 'choose') speak(k);
      setTimeout(nextQ, reduceMotion ? 450 : 750);
      return;
    }
    $('.mark', btn).setAttribute('class', 'mark no');
    $('.mark', correctBtn).setAttribute('class', 'mark ok');
    speak(k);
  }
  const fb = $('#qfb', root);
  fb.innerHTML =
    '<div class="fb" role="status"><div class="ans">' +
    t('q.is', { k, r: rom(k) }) +
    '</div><p class="small" id="fbGiven"></p><p>' +
    explain(k) +
    '</p><button class="btn primary" id="qNext" style="width:100%">' +
    t('next') +
    '</button></div>';
  if (s.mode === 'read' && (given || '').trim())
    $('#fbGiven', fb).textContent = t('q.typed', { v: given.trim() });
  else if (s.mode !== 'read' && given)
    $('#fbGiven', fb).textContent = t('q.picked', { k: given, r: rom(given) });
  $('#qNext', fb).onclick = () => {
    nextQ();
    const inp = $('#qin');
    if (inp) inp.focus();
  };
  const nb = $('#qNext', fb);
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

function renderResults(root) {
  const s = ui.session,
    r = s.results;
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
  if (miss)
    miss.onclick = () => {
      const pool = s.misses.slice();
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
    };
  $('#rAgain', root).onclick = () => {
    if (s.src === 'miss') {
      const pool = s.pool.slice();
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
      return;
    }
    const pool = drillPool();
    ui.session = null;
    startDrill(pool.length ? pool : s.pool);
  };
  $('#rSetup', root).onclick = () => {
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
  const rd = $('#rDone', root);
  if (rd)
    rd.onclick = () => {
      setDayComplete(day, true);
      rd.textContent = t('plan.marked', { d: day });
      rd.disabled = true;
    };
}
