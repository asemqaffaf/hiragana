import {hasClip, speakFull} from '../core/audio.js';
import {reduceAnim} from '../core/motion.js';
import {showTab} from '../core/nav.js';
import {commit, logActivity, me, state} from '../core/storage.js';
import {ui} from '../core/ui-state.js';
import {DROWS, ROWS, rom} from '../data/letters.js';
import {lesson, saveLesson, writeList} from './lesson.js';
import {t} from '../i18n/core.js';
import {judgeStroke, strokeCount, strokeMessage, strokeTemplates} from '../strokes/check.js';
import {strokeSVG} from '../strokes/draw.js';
import {$, $$, MARK_SVG, SPEAK_SVG, todayISO} from '../util.js';

/* ---------- write ---------- */
const WGROUPS = [...ROWS.map(r => ({id:r.id, label:r.kana[0], kana:r.kana.filter(Boolean)})), ...DROWS.map(r => ({id:r.id, label:r.kana[0], kana:r.kana})), {id:'sm', label:'ゃ', kana:['ゃ','ゅ','ょ','っ']}];
const CLEAN_GOAL = 3;
/* A letter can be completed once the student has listened to it and written it cleanly CLEAN_GOAL times */
export const isComplete = k => !!(state.cl || {})[k];
const canComplete = k => !isComplete(k) && (state.heard[k] || 0) > 0 && wsOf(k).p >= CLEAN_GOAL;
function completeLetter(k, on) {
  const cl = Object.assign({}, state.cl);
  if (on) cl[k] = todayISO(); else delete cl[k];
  state.cl = cl; commit();
}
function completeHtml(k) {
  if (isComplete(k)) return '<span class="tag done">' + t('cl.done') + '</span><button class="link" id="wUncomplete" type="button">' + t('cl.undo') + '</button>';
  const heard = (state.heard[k] || 0) > 0, p = wsOf(k).p;
  return '<span class="cl-need small muted">' + t('cl.need', {heard: heard ? t('cl.ok') : t('cl.todo'), p: Math.min(p, CLEAN_GOAL), g: CLEAN_GOAL}) + '</span>';
}
function refreshComplete() {
  const box = $('#wComplete'), k = ui.writeK;
  if (!box) return;
  box.innerHTML = completeHtml(k);
  const u = $('#wUncomplete'); if (u) u.onclick = () => { completeLetter(k, false); refreshComplete(); markStrip(k); };
  const btn = $('#wCompleteBtn');
  if (btn) { btn.hidden = !canComplete(k); btn.textContent = t('cl.btn', {k}); }
}
function markStrip(k) { const b = $('.strip [data-wk="' + k + '"]'); if (b) b.classList.toggle('cl', isComplete(k)); }
export function groupOf(k) { const g = WGROUPS.find(g => g.kana.includes(k)); return g ? g.id : 'a'; }
const wsOf = k => Object.assign({n: 0, p: 0}, (state.ws || {})[k]);
function cleanText(k) { return t('clean', {p: wsOf(k).p}); }
function nextWrite() {
  const g = WGROUPS.find(x => x.id === ui.writeGroup) || WGROUPS[0], i = g.kana.indexOf(ui.writeK);
  if (i >= 0 && i < g.kana.length - 1) return {k: g.kana[i + 1], g: g.id};
  const ng = WGROUPS[(WGROUPS.indexOf(g) + 1) % WGROUPS.length];
  return {k: ng.kana[0], g: ng.id};
}
function newAttempt() { return {k: ui.writeK, tpl: strokeTemplates(ui.writeK), i: 0, miss: 0, sm: 0, done: false, recorded: false}; }
function wSay(text, cls) { const el = $('#wStat'); if (!el) return; el.textContent = text; el.className = 'wstat' + (cls ? ' ' + cls : ''); }
function startText() { return t('w.start', {n: ui.wq.tpl.pts.length, nums: ui.writeNums}); }
function setMark(on) { const m = $('#wsq .mark'); if (m) m.setAttribute('class', 'mark' + (on ? ' ok' : '')); }
/* The bar under the writing area. Writing a lesson's letters: it is always there, Next waits (dimmed) until the letter is written.
   Free writing: it appears once the letter is written. */
function showDone(on) {
  const dn = $('#wDone'); if (!dn) return;
  dn.hidden = !on && !ui.lessonWrite;
  dn.classList.toggle('waiting', !on);
  const nx = $('#wNext', dn), again = $('#wAgain', dn);
  if (nx) { nx.disabled = !on; nx.setAttribute('aria-disabled', String(!on)); }
  if (again) again.hidden = !on;
  /* the writing area sits above this bar, so on a short phone it can be off screen when the letter is finished */
  if (on && !reduceAnim()) dn.scrollIntoView({block: 'nearest', behavior: 'smooth'}); else if (on) dn.scrollIntoView({block: 'nearest'});
}
function restartAttempt() {
  ui.wq = newAttempt(); ui.demoShown = false;
  if (ui.writeSvg) { ui.writeSvg.clearHint(); ui.writeSvg.showUpTo(0); }
  if (ui.pad) ui.pad.clear();
  setMark(false);
  showDone(false);
  wSay(startText());
}
function finishWrite() {
  const n = ui.wq.tpl.pts.length;
  ui.wq.done = true;
  if (!ui.wq.recorded) {
    ui.wq.recorded = true;
    const w = wsOf(ui.wq.k); w.n++; if (!ui.wq.miss) w.p++;
    state.ws = Object.assign({}, state.ws, {[ui.wq.k]: w});
    logActivity();
    commit();
  }
  if (ui.lessonWrite && writeList().includes(ui.wq.k)) { const x = lesson(); if (!x.w.includes(ui.wq.k)) { x.w = x.w.concat([ui.wq.k]); saveLesson(x); } }
  if (!ui.wq.miss) { setMark(true); wSay(t('w.allRight', {n, clean: cleanText(ui.wq.k)}), 'good'); }
  else wSay(t('w.finished', {m: ui.wq.miss}), 'bad');
  const c = $('#wCount'); if (c) c.textContent = cleanText(ui.wq.k);
  const bar = $('.strip [data-wk="' + ui.wq.k + '"] .wm'); if (bar) bar.style.setProperty('--m', Math.min(wsOf(ui.wq.k).p, CLEAN_GOAL) / CLEAN_GOAL);
  showDone(true);
  refreshComplete();
  if (canComplete(ui.wq.k)) wSay(t('cl.ready', {k: ui.wq.k}), 'good');
  else if (!isComplete(ui.wq.k) && !(state.heard[ui.wq.k] > 0) && wsOf(ui.wq.k).p >= CLEAN_GOAL) wSay(t('cl.listen'), 'good');
}
const writeHandler = {
  begin() {
    if (!ui.wq || !ui.writeSvg) return;
    if (ui.wq.done) restartAttempt();
    else if (ui.demoShown) { ui.demoShown = false; ui.writeSvg.showUpTo(ui.wq.i); }
    ui.writeSvg.clearHint();
  },
  end(pts) {
    if (!ui.wq || !ui.wq.tpl) return 'ignore';
    const n = ui.wq.tpl.pts.length, i = ui.wq.i;
    const v = judgeStroke(pts, ui.wq.tpl, i, (ui.writeGuide ? 1 : 1.35) * ((me() || {}).age === 'child' ? 1.2 : 1));
    if (v.kind === 'tiny') { wSay(strokeMessage(v, i, ui.writeNums), 'bad'); return 'ignore'; }
    if (v.kind === 'ok') {
      ui.wq.i++; ui.wq.sm = 0;
      ui.writeSvg.showUpTo(ui.wq.i);
      if (ui.wq.i >= n) finishWrite();
      else wSay(t('w.right', {i: i + 1, j: i + 2, n}), 'good');
      return 'ok';
    }
    ui.wq.miss++; ui.wq.sm++;
    wSay(strokeMessage(v, i, ui.writeNums), 'bad');
    if (v.kind === 'shape' || ui.wq.sm >= 2) ui.writeSvg.hint(i);
    return 'bad';
  }
};
const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
  hint: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  undo: '<svg class="mir" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.5L4.5 11 9 15.5M5 11h9.5a5 5 0 0 1 0 10H12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  restart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 3.5V8H9" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  clear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
};
const tool = (id, icon, label, cls) => '<button class="tool' + (cls ? ' ' + cls : '') + '" id="' + id + '" type="button">' + icon + '<span>' + label + '</span></button>';
export function renderWrite(play) {
  const g = WGROUPS.find(x => x.id === ui.writeGroup) || WGROUPS[0];
  if (!g.kana.includes(ui.writeK)) ui.writeK = g.kana[0];
  const wl = ui.lessonWrite ? writeList() : [], li = wl.indexOf(ui.writeK);
  const n = strokeCount(ui.writeK), nx = li >= 0 ? (li < wl.length - 1 ? {k: wl[li + 1], g: groupOf(wl[li + 1])} : {k: '', g: ''}) : nextWrite();
  let h = '<h2>' + t('tab.write') + '</h2>';
  h += '<div class="chips rowpick" role="group" aria-label="' + t('write.rows') + '">' + WGROUPS.map(x => '<button class="chip" data-wg="' + x.id + '" aria-pressed="' + (x.id === g.id) + '"><span class="kana">' + x.label + '</span></button>').join('') + '</div>';
  h += '<div class="strip">' + g.kana.map(k => '<button class="sq' + (isComplete(k) ? ' cl' : '') + '" data-wk="' + k + '" aria-pressed="' + (k === ui.writeK) + '" aria-label="' + k + ', ' + rom(k) + ', ' + cleanText(k) + (isComplete(k) ? ', ' + t('cl.done') : '') + '"><span class="k">' + k + '</span><span class="wm" style="--m:' + (Math.min(wsOf(k).p, CLEAN_GOAL) / CLEAN_GOAL) + '"></span></button>').join('') + '</div>';
  h += '<div class="wgrid"><div class="wleft">';
  h += '<p class="wmeta"><b>' + rom(ui.writeK) + '</b><span class="muted small">' + t('strokes', {n}) + '</span>' + (ui.writeCheck ? '<span class="muted small" id="wCount">' + cleanText(ui.writeK) + '</span>' : '') + '</p>' + '';
  h += '<div class="sq wsq" id="wsq"><canvas id="wpad" aria-label="' + t('write.area', {k: ui.writeK}) + '"></canvas>' + MARK_SVG + '</div>';
  h += '</div><div class="wright">';
  h += '<p class="wstat" id="wStat" role="status" aria-live="polite">' + (ui.writeCheck ? '' : t('write.free')) + '</p>';
  h += '<div class="tools">' + tool('wPlay', ICON.play, t('write.play'), 'primary') + tool('wSay', SPEAK_SVG, t('write.hear'));
  h += ui.writeCheck
    ? tool('wHint', ICON.hint, t('write.hint')) + tool('wUndo', ICON.undo, t('write.undo')) + tool('wClear', ICON.restart, t('write.restart'))
    : tool('wUndo', ICON.undo, t('write.undo')) + tool('wClear', ICON.clear, t('write.clear'));
  h += '</div>';
  h += '<div class="btnrow wdone actionbar inflow" id="wDone" hidden><button class="btn" id="wAgain" hidden>' + t('write.again') + '</button><button class="btn primary" id="wNext" disabled aria-disabled="true">' + (nx.k ? t('write.next') + ' <span class="kana">' + nx.k + '</span>' : t('lesson.back')) + '</button></div>';
  h += '<button class="btn red" id="wCompleteBtn" hidden></button>';
  if (ui.writeCheck) h += '<p class="wcomp" id="wComplete"></p>';
  h += '<div class="toggles opts"><label><input type="checkbox" id="wGuide"' + (ui.writeGuide ? ' checked' : '') + '> ' + t('write.guide') + '</label><label><input type="checkbox" id="wNums"' + (ui.writeNums ? ' checked' : '') + '> ' + t('write.nums') + '</label><label><input type="checkbox" id="wCheck"' + (ui.writeCheck ? ' checked' : '') + '> ' + t('write.check') + '</label></div>';
  h += '<details class="more wtips"><summary>' + t('write.howTitle') + '</summary><p class="small">' + (ui.writeCheck ? t('write.howCheck') : t('write.howFree')) + '</p></details>';
  h += '</div></div>';
  const root = $('#tab-write');
  root.innerHTML = h;
  showDone(false);
  const rp = $('.rowpick', root), rc = rp && $('[aria-pressed="true"]', rp);
  if (rc) rp.scrollLeft += (rc.getBoundingClientRect().left + rc.offsetWidth / 2) - (rp.getBoundingClientRect().left + rp.clientWidth / 2);
  const wsq = $('#wsq', root);
  ui.writeSvg = strokeSVG(ui.writeK, {guide: ui.writeGuide, nums: ui.writeNums, inkHidden: true});
  if (ui.writeSvg) wsq.insertBefore(ui.writeSvg, wsq.firstChild);
  ui.wq = ui.writeCheck ? newAttempt() : null;
  ui.demoShown = false;
  ui.pad = makePad($('#wpad', root), ui.writeCheck && ui.wq && ui.wq.tpl ? writeHandler : null);
  if (ui.writeCheck && ui.wq) wSay(startText());
  $$('[data-wg]', root).forEach(b => b.onclick = () => { ui.writeGroup = b.dataset.wg; ui.writeK = WGROUPS.find(x => x.id === ui.writeGroup).kana[0]; renderWrite(); });
  $$('[data-wk]', root).forEach(b => b.onclick = () => { ui.lessonWrite = false; ui.writeK = b.dataset.wk; renderWrite(true); });
  $('#wGuide', root).onchange = e => { ui.writeGuide = e.target.checked; if (ui.writeSvg) ui.writeSvg.classList.toggle('no-guide', !ui.writeGuide); };
  $('#wNums', root).onchange = e => { ui.writeNums = e.target.checked; if (ui.writeSvg) ui.writeSvg.classList.toggle('no-num', !ui.writeNums); };
  $('#wCheck', root).onchange = e => { ui.writeCheck = e.target.checked; renderWrite(); };
  $('#wPlay', root).onclick = () => {
    if (ui.pad) ui.pad.clear();
    if (ui.writeCheck && ui.wq) { restartAttempt(); ui.demoShown = true; wSay(t('w.watch', {n: ui.wq.tpl.pts.length})); }
    if (ui.writeSvg) ui.writeSvg.play();
  };
  const ws = $('#wSay', root); if (!hasClip(ui.writeK)) { ws.disabled = true; ws.title = t('write.silent'); } else ws.onclick = () => { speakFull(ui.writeK); refreshComplete(); if (ui.wq && ui.wq.done && canComplete(ui.writeK)) wSay(t('cl.ready', {k: ui.writeK}), 'good'); };
  const hb = $('#wHint', root);
  if (hb) hb.onclick = () => { if (ui.wq && !ui.wq.done && ui.writeSvg) { if (ui.demoShown) { ui.demoShown = false; ui.writeSvg.showUpTo(ui.wq.i); } ui.writeSvg.hint(ui.wq.i); } };
  $('#wUndo', root).onclick = () => {
    if (!ui.writeCheck || !ui.wq) { if (ui.pad) ui.pad.undo(); return; }
    if (ui.wq.done) { ui.wq.done = false; ui.wq.i = ui.wq.tpl.pts.length - 1; setMark(false); showDone(false); }
    else if (ui.wq.i > 0) ui.wq.i--;
    ui.wq.sm = 0; ui.demoShown = false;
    if (ui.pad) ui.pad.clear();
    ui.writeSvg.clearHint(); ui.writeSvg.showUpTo(ui.wq.i);
    wSay(t('w.draw', {i: ui.wq.i + 1, n: ui.wq.tpl.pts.length}));
  };
  $('#wClear', root).onclick = () => {
    if (!ui.writeCheck || !ui.wq) { if (ui.pad) ui.pad.clear(); if (ui.writeSvg) ui.writeSvg.showInk(false); return; }
    restartAttempt();
  };
  $('#wAgain', root).onclick = () => restartAttempt();
  const cb = $('#wCompleteBtn', root);
  if (cb) cb.onclick = () => { completeLetter(ui.writeK, true); cb.hidden = true; refreshComplete(); markStrip(ui.writeK); wSay(t('cl.saved', {k: ui.writeK}), 'good'); };
  if (ui.writeCheck) refreshComplete();
  $('#wNext', root).onclick = () => { if (!nx.k) { ui.lessonWrite = false; showTab('plan'); return; } ui.writeGroup = nx.g; ui.writeK = nx.k; renderWrite(true); };
  if (play && ui.writeSvg) { ui.demoShown = !!ui.wq; if (ui.wq) wSay(t('w.watch', {n: ui.wq.tpl.pts.length})); ui.writeSvg.play(); }
}
function makePad(canvas, handler) {
  const ctx = canvas.getContext('2d');
  let strokes = [], cur = null, active = null, w = 0, h = 0, fadeT = null;
  const color = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#262422';
  function setStyle(c) { ctx.lineWidth = Math.max(4, w * 0.034); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color(c); }
  function size() {
    const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }
  function seg(a, b) { ctx.beginPath(); ctx.moveTo(a[0] * w, a[1] * h); ctx.lineTo(b[0] * w + (a === b ? 0.1 : 0), b[1] * h); ctx.stroke(); }
  function drawStroke(s) { setStyle(s.c); seg(s.pts[0], s.pts[0]); for (let i = 1; i < s.pts.length; i++) seg(s.pts[i - 1], s.pts[i]); }
  function redraw() { ctx.clearRect(0, 0, w, h); strokes.forEach(drawStroke); }
  function pt(e) { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; }
  function stopFade() { if (fadeT) { clearTimeout(fadeT); fadeT = null; } canvas.style.opacity = ''; strokes = strokes.filter(s => !s.bad); }
  canvas.addEventListener('pointerdown', e => {
    if (active !== null) return;
    e.preventDefault();
    stopFade(); redraw();
    active = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
    if (handler) handler.begin();
    cur = {pts: [pt(e)], c: '--ink'}; strokes.push(cur);
    setStyle(cur.c); seg(cur.pts[0], cur.pts[0]);
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerId !== active || !cur) return;
    e.preventDefault();
    const evs = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
    setStyle(cur.c);
    evs.forEach(ev => { const p = pt(ev), last = cur.pts[cur.pts.length - 1]; if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.002) return; cur.pts.push(p); seg(last, p); });
  });
  function end(e) {
    if (e.pointerId !== active) return;
    active = null;
    const s = cur; cur = null;
    if (!s || !handler) return;
    const v = handler.end(s.pts);
    if (v === 'bad') {
      s.c = '--red'; s.bad = true; redraw();
      fadeT = setTimeout(() => { canvas.style.opacity = '0'; fadeT = setTimeout(() => { strokes = strokes.filter(x => x !== s); redraw(); canvas.style.opacity = ''; fadeT = null; }, 280); }, 800);
    } else { strokes = strokes.filter(x => x !== s); redraw(); }
  }
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', e => { if (e.pointerId !== active) return; active = null; strokes = strokes.filter(x => x !== cur); cur = null; redraw(); });
  canvas.addEventListener('pointerleave', e => { if (e.pointerId === active && !(canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId))) end(e); });
  if (ui.padObserver) ui.padObserver.disconnect();
  if (window.ResizeObserver) { ui.padObserver = new ResizeObserver(size); ui.padObserver.observe(canvas); } else window.onresize = size;
  size();
  return {clear() { stopFade(); strokes = []; redraw(); }, undo() { strokes.pop(); redraw(); }, redraw};
}
