import {bindSay, cacheClip, exampleHtml, moreExHtml, speakFull} from '../core/audio.js';
import {replay} from '../core/motion.js';
import {showTab} from '../core/nav.js';
import {PL, PLEN, curDay, dayNumber, focusKana, todayPool} from '../core/plan.js';
import {commit, state} from '../core/storage.js';
import {ui} from '../core/ui-state.js';
import {rom} from '../data/letters.js';
import {dailyFor} from './daily.js';
import {startDrill} from './drill.js';
import {groupOf} from './write.js';
import {t} from '../i18n/core.js';
import {explain} from '../i18n/helpers.js';
import {strokeSVG} from '../strokes/draw.js';
import {$, SPEAK_SVG} from '../util.js';

/* ---------- guided daily lesson ---------- */
export const lessonOn = () => { const n = dayNumber(); return n >= 1 && n <= PLEN(); };
export function lesson() { return Object.assign({m: [], w: [], q: -1, r: false, d: [], dd: false}, (state.les || {})[String(curDay())]); }
export function saveLesson(x) { state.les = Object.assign({}, state.les, {[String(curDay())]: x}); commit(); }
export const writeList = () => { const f = focusKana(curDay()); return f.length && f.length <= 10 && f.every(k => k.length === 1) ? f : []; };
export function lessonSteps() {
  const day = curDay(), focus = focusKana(day), x = lesson(), wl = writeList(), steps = [];
  if (focus.length) steps.push({id: 'meet', n: focus.filter(k => x.m.includes(k)).length, m: focus.length});
  if (wl.length) steps.push({id: 'write', n: wl.filter(k => x.w.includes(k)).length, m: wl.length});
  const dw = dailyFor(day);
  if (dw.length) steps.push({id: 'words', n: x.dd ? dw.length : dw.filter(w => x.d.includes(w[0])).length, m: dw.length});
  if (PL()[day - 1].base.some(b => b >= 10 && b <= 12)) steps.push({id: 'read', n: x.r ? 1 : 0, m: 1});
  steps.push({id: 'quiz', n: x.q >= 90 ? 1 : 0, m: 1, score: x.q});
  steps.forEach(s => { s.done = s.n >= s.m; });
  return steps;
}
export function runStep(id) {
  const focus = focusKana(curDay()), x = lesson();
  if (id === 'meet') { ui.meetI = Math.max(0, focus.findIndex(k => !x.m.includes(k))); showTab('meet'); }
  else if (id === 'write') { const wl = writeList(); ui.lessonWrite = true; ui.writeK = wl.find(k => !x.w.includes(k)) || wl[0]; ui.writeGroup = groupOf(ui.writeK); ui.writeCheck = true; showTab('write'); }
  else if (id === 'read') showTab('read');
  else if (id === 'words') showTab('daily');
  else { const pool = todayPool(); ui.lessonQuiz = true; ui.drillMode = 'read'; ui.drillLen = Math.min(20, Math.max(10, pool.length)); ui.session = null; showTab('drill'); startDrill(pool); }
}
export function renderMeet() {
  const list = focusKana(curDay());
  if (!list.length) { showTab('plan', {replace: true}); return; }
  ui.meetI = Math.min(Math.max(ui.meetI, 0), list.length - 1);
  const k = list[ui.meetI], x = lesson(), last = ui.meetI === list.length - 1;
  if (!x.m.includes(k)) { x.m = x.m.concat([k]); saveLesson(x); }
  let h = '<div class="meettop"><span class="small muted">' + t('meet.count', {i: ui.meetI + 1, n: list.length}) + '</span><div class="rbar"><i style="width:' + Math.round((ui.meetI + 1) / list.length * 100) + '%"></i></div></div>';
  h += '<div class="meetcard"><div class="sq meetsq" id="meetSq">' + (k.length > 1 ? '<span class="k txt">' + k + '</span>' : '') + '</div>';
  h += '<div class="meetrom ltr">' + rom(k) + '</div>';
  h += '<button class="btn primary bigbtn" id="meetHear">' + SPEAK_SVG.replace('<svg', '<svg width="24" height="24"') + ' ' + t('card.hear') + '</button>';
  h += '<p class="hook">' + explain(k) + '</p>' + exampleHtml(k) + moreExHtml(k) + '</div>';
  h += '<div class="btnrow meetnav actionbar"><button class="btn" id="meetPrev"' + (ui.meetI ? '' : ' disabled') + '>' + t('meet.prev') + '</button><button class="btn primary" id="meetNext">' + (last ? t('meet.finish') : t('meet.next')) + '</button></div>';
  const root = $('#tab-meet');
  root.innerHTML = '<h2>' + t('tab.meet') + '</h2>' + h;
  if (renderMeet.last !== undefined && renderMeet.last !== ui.meetI && ui.currentTab === 'meet') replay($('.meetcard', root), 'flip');
  renderMeet.last = ui.meetI;
  if (k.length === 1) { const svg = strokeSVG(k, {guide: true}); if (svg) { $('#meetSq', root).appendChild(svg); setTimeout(() => svg.play(), 200); } }
  $('#meetHear', root).onclick = () => speakFull(k);
  bindSay(root);
  $('#meetPrev', root).onclick = () => { ui.meetI--; renderMeet(); };
  $('#meetNext', root).onclick = () => { if (last) showTab('plan'); else { ui.meetI++; renderMeet(); window.scrollTo(0, 0); } };
  setTimeout(() => speakFull(k), 300);
  cacheClip(k + '|ex'); if (list[ui.meetI + 1]) cacheClip(list[ui.meetI + 1] + '|ex');
}
