import {dayNumber, goalOf, planDaysFor} from '../core/plan.js';
import {level} from '../core/stats.js';
import {me, state} from '../core/storage.js';
import {A46, ALL, DAK25, YOON33, rom} from '../data/letters.js';
import {streakOf} from './login.js';
import {isComplete} from './write.js';
import {t} from '../i18n/core.js';
import {fmt} from '../i18n/helpers.js';
import {$, addDays, esc, todayISO} from '../util.js';

/* ---------- progress and roadmap ---------- */
export function renderProgress() {
  const p = me(); if (!p) return;
  const lv = {solid: 0, learning: 0, 'new': 0};
  ALL.forEach(k => lv[level(k)]++);
  let ans = 0, right = 0, wp = 0;
  Object.values(state.stats).forEach(s => { ans += s.c + s.w; right += s.c; });
  Object.values(state.ws).forEach(w => { wp += w.p; });
  const days = Object.keys(state.act).length, streak = streakOf(state.act), today = dayNumber();
  const solidIn = list => list.filter(k => level(k) === 'solid').length;
  const seenIn = list => list.filter(k => level(k) !== 'new').length;
  let h = '<h2>' + t('tab.progress') + '</h2><p class="muted">' + t('pg.intro', {name: esc(p.name)}) + '</p>';
  /* headline numbers */
  const nCl = Object.keys(state.cl || {}).length;
  const tiles = [[nCl, t('pg.completed', {n: nCl})], [lv.solid, t('pg.solid')], [ans ? Math.round(right / ans * 100) + '%' : '-', t('pg.accuracy')], [wp, t('pg.clean', {n: wp})], [streak, t('pg.streak', {n: streak})], [days, t('pg.days', {n: days})]];
  h += '<div class="pstat">' + tiles.map(x => '<div><b>' + x[0] + '</b><span>' + x[1] + '</span></div>').join('') + '</div>';
  /* roadmap */
  const ms = [
    {k: 'm1', b: [1, 2, 3, 4, 5], v: seenIn(A46), m: 46, sub: 'rm.m1d'},
    {k: 'm2', b: [6, 7], v: solidIn(A46), m: 46, sub: 'rm.solidD'},
    {k: 'm3', b: [8], v: solidIn(DAK25), m: 25, sub: 'rm.solidD'},
    {k: 'm4', b: [9], v: solidIn(YOON33), m: 33, sub: 'rm.solidD'},
    {k: 'm5', b: [10, 11, 12]},
    {k: 'm6', b: [13, 14]}
  ];
  ms.forEach(x => {
    const pd = planDaysFor(x.b);
    x.d = pd.length > 1 ? pd[0] + '-' + pd[pd.length - 1] : String(pd[0]);
    if (x.v === undefined) { x.v = pd.filter(dn => state.done[dn]).length; x.m = pd.length; x.sub = 'rm.daysDone'; }
  });
  let cur = ms.findIndex(x => x.v < x.m);
  h += '<h3>' + t('pg.road') + '</h3><p class="small muted">' + t('pg.roadIntro') + '</p><ol class="road">';
  ms.forEach((x, i) => {
    const st = x.v >= x.m ? 'done' : i === cur ? 'now' : 'next';
    const pct = Math.round(x.v / x.m * 100);
    h += '<li class="' + st + '"><span class="node" aria-hidden="true">' + (st === 'done' ? '<svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="17" transform="rotate(-110 22 22)"/></svg>' : '') + '</span><div class="rbody">'
      + '<div class="rhead"><b>' + t('rm.' + x.k) + '</b><span class="small muted">' + t(x.d.includes('-') ? 'rm.days' : 'rm.day', {d: x.d}) + '</span></div>'
      + '<div class="rbar" role="img" aria-label="' + t('rm.of', {v: x.v, m: x.m}) + '"><i style="width:' + pct + '%"></i></div>'
      + '<div class="small"><span class="muted">' + t(x.sub) + ': </span>' + t('rm.of', {v: x.v, m: x.m}) + (st === 'done' ? ' <span class="tag">' + t('rm.done') + '</span>' : st === 'now' ? ' <span class="tag now">' + t('rm.now') + '</span>' : '') + '</div></div></li>';
  });
  h += '<li class="later"><span class="node" aria-hidden="true"></span><div class="rbody"><div class="rhead"><b>' + t('rm.kata') + '</b><span class="small muted">' + t('rm.after') + '</span></div><p class="small muted">' + t('rm.kataD') + '</p></div></li>';
  const rs = goalOf().reason;
  if (rs !== 'all') h += '<li class="later"><span class="node" aria-hidden="true"></span><div class="rbody"><div class="rhead"><b>' + t(rs === 'jlpt' ? 'rm.n5' : 'rm.goal.' + rs) + '</b><span class="small muted">' + t('goal.reason.' + rs) + '</span></div><p class="small muted">' + t(rs === 'jlpt' ? 'rm.n5D' : 'rm.goalD.' + rs) + '</p></div></li>';
  h += '</ol>';
  /* every character, by mastery */
  h += '<h3>' + t('pg.map') + '</h3><p class="small muted">' + t('pg.mapIntro') + '</p>';
  h += '<div class="legend">' + ['solid', 'learning', 'new'].map(l => '<span><i class="lv-' + l + '"></i>' + t('lv.' + l) + ' (' + lv[l] + ')</span>').join('') + '<span><i class="lv-cl"></i>' + t('cl.done') + ' (' + nCl + ')</span></div>';
  [[t('chart.basic'), A46], [t('chart.dak'), DAK25], [t('chart.yoon'), YOON33]].forEach(([title, list]) => {
    h += '<p class="small mapt">' + title + '</p><div class="cmap' + (list === YOON33 ? ' yo' : '') + '">' + list.map(k => '<button class="lv-' + level(k) + (isComplete(k) ? ' cl' : '') + '" data-open="' + k + '" title="' + k + ' ' + rom(k) + ': ' + t('lv.' + level(k)) + '">' + k + '</button>').join('') + '</div>';
  });
  /* last 28 days */
  const start = addDays(todayISO(), -27), cells = [];
  for (let i = 0; i < 28; i++) { const d = addDays(start, i), n = state.act[d] || 0; cells.push({d, n}); }
  const lvl = n => n === 0 ? 0 : n < 10 ? 1 : n < 30 ? 2 : n < 60 ? 3 : 4;
  h += '<h3>' + t('pg.activity') + '</h3><div class="cal" role="img" aria-label="' + t('pg.activity') + ': ' + t('pg.calSum', {n: cells.filter(c => c.n).length}) + '">' + cells.map(c => '<i class="a' + lvl(c.n) + (c.d === todayISO() ? ' today' : '') + '" title="' + fmt(c.d) + ': ' + t('pg.actN', {n: c.n}) + '"></i>').join('') + '</div>';
  h += '<div class="calx small muted"><span>' + fmt(start) + '</span><span>' + fmt(todayISO()) + '</span></div><p class="small muted">' + t('pg.actLegend') + '</p>';
  /* recent drill rounds */
  const rd = (state.rounds || []).slice(-14);
  h += '<h3>' + t('pg.rounds') + '</h3>';
  if (!rd.length) h += '<p class="small muted">' + t('pg.noRounds') + '</p>';
  else {
    h += '<div class="rounds" role="img" aria-label="' + t('pg.rounds') + ': ' + rd.map(x => x.p + '%').join(', ') + '"><span class="goal" style="bottom:90%"></span>' + rd.map(x => '<i style="height:' + Math.max(2, x.p) + '%" title="' + t('pg.roundTip', {date: fmt(x.d), n: x.n, p: x.p}) + '"></i>').join('') + '</div>';
    h += '<p class="small muted">' + t('pg.roundsNote') + '</p>';
  }
  $('#tab-progress').innerHTML = h;
}
