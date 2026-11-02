import { PL, PLEN, dayNumber, focusKana, goalOf, planDaysFor } from '../core/plan.js';
import { showTab } from '../core/nav.js';
import { level, streakOf } from '../core/stats.js';
import { me, state } from '../core/store.js';
import { A46, ALL, DAK25, YOON33, rom } from '../data/letters.js';
import { isComplete } from '../core/progress.js';
import { t } from '../i18n/core.js';
import { fmt } from '../i18n/helpers.js';
import { $, $$, addDays, esc, must, todayISO, valuesOf } from '../util.js';

/* ---------- progress and roadmap ---------- */
export function renderProgress() {
  const p = me();
  if (!p) return;
  /** @type {Record<import('../../types/app').LetterLevel, number>} */
  const lv = { solid: 0, learning: 0, new: 0 };
  ALL.forEach((k) => lv[level(k)]++);
  let ans = 0,
    right = 0,
    wp = 0;
  valuesOf(state.stats).forEach((s) => {
    ans += s.c + s.w;
    right += s.c;
  });
  valuesOf(state.ws).forEach((w) => {
    wp += w.p;
  });
  const days = Object.keys(state.act).length,
    streak = streakOf(state.act),
    today = dayNumber();
  /** @param {string[]} list */
  const solidIn = (list) => list.filter((k) => level(k) === 'solid').length;
  /** @param {string[]} list */
  const seenIn = (list) => list.filter((k) => level(k) !== 'new').length;
  const total = PLEN(),
    doneDays = Object.keys(state.done).filter((d) => Number(d) >= 1 && Number(d) <= total).length;
  let h = '<h2>' + t('tab.progress') + '</h2>';
  /* where you are: one card with the day, the lessons finished, and the way to the next step */
  h +=
    '<section class="pghero"><p class="small muted">' +
    t('pg.intro', { name: esc(p.name) }) +
    '</p><p class="pbig">' +
    (today < 1
      ? t('plan.starts', { date: fmt(state.start) })
      : today > total
        ? t('plan.complete')
        : t('plan.dayOf', { n: today, total })) +
    '</p><div class="rbar" role="img" aria-label="' +
    t('pg.lessonsDone', { v: doneDays, m: total }) +
    '"><i style="width:' +
    Math.round((doneDays / total) * 100) +
    '%"></i></div><p class="small">' +
    t('pg.lessonsDone', { v: doneDays, m: total }) +
    '</p>' +
    (today >= 1 && today <= total
      ? '<div class="btnrow"><button class="btn primary" id="pgToday">' + t('pg.goToday') + '</button></div>'
      : '') +
    '</section>';
  /* four numbers that matter */
  const tiles = [
    [streak, t('pg.streak', { n: streak })],
    [days, t('pg.days', { n: days })],
    [lv.solid, t('pg.solid')],
    [ans ? Math.round((right / ans) * 100) + '%' : '-', t('pg.accuracy')],
  ];
  h +=
    '<div class="pstat">' +
    tiles.map((x) => '<div><b>' + x[0] + '</b><span>' + x[1] + '</span></div>').join('') +
    '</div>';
  /* the lessons: finished ones, today's, and what comes next */
  /** @param {number} dn */
  const lessonRow = (dn) => {
    const pl = PL()[dn - 1],
      doneOn = state.done[dn],
      st = doneOn ? 'done' : dn === today ? 'now' : dn < today ? 'open' : 'up',
      fk = focusKana(dn);
    return (
      '<li class="lrow ' +
      st +
      '"><span class="ldot" aria-hidden="true">' +
      (doneOn ? '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : dn) +
      '</span><span class="lt"><b>' +
      t('plan.prevDay', { n: dn, title: pl.t }) +
      '</b><span class="small muted">' +
      (doneOn
        ? t('plan.prevDone', { date: fmt(doneOn) })
        : st === 'now'
          ? t('pg.lessonToday')
          : st === 'open'
            ? t('plan.prevOpen')
            : fmt(addDays(state.start, dn - 1))) +
      '</span></span><span class="kp">' +
      fk.slice(0, 6).join('') +
      '</span></li>'
    );
  };
  const near = Array.from({ length: total }, (_, i) => i + 1).filter(
    (dn) => state.done[dn] || (dn >= today - 1 && dn <= today + 1),
  );
  const rest = Array.from({ length: total }, (_, i) => i + 1).filter((dn) => !near.includes(dn));
  h += '<h3>' + t('pg.lessons') + '</h3><ol class="lessons">' + near.map(lessonRow).join('') + '</ol>';
  if (rest.length)
    h +=
      '<details class="more fold"><summary>' +
      t('pg.lessonAll', { total }) +
      '</summary><ol class="lessons">' +
      Array.from({ length: total }, (_, i) => i + 1).map(lessonRow).join('') +
      '</ol></details>';
  /* letters, grouped */
  const nCl = Object.keys(state.cl || {}).length;
  /** @type {[string, string[]][]} */
  const groups = [
    [t('chart.basic'), A46],
    [t('chart.dak'), DAK25],
    [t('chart.yoon'), YOON33],
  ];
  h += '<h3>' + t('pg.letters') + '</h3><div class="groups">';
  groups.forEach(([title, list]) => {
    const so = solidIn(list),
      le = list.filter((k) => level(k) === 'learning').length;
    h +=
      '<div class="grp"><div class="rhead"><b>' +
      title +
      '</b><span class="small muted">' +
      t('pg.groupSolid', { v: so, m: list.length }) +
      '</span></div><div class="stk" role="img" aria-label="' +
      t('pg.groupSolid', { v: so, m: list.length }) +
      '"><i class="lv-solid" style="width:' +
      (so / list.length) * 100 +
      '%"></i><i class="lv-learning" style="width:' +
      (le / list.length) * 100 +
      '%"></i></div></div>';
  });
  h +=
    '</div><div class="legend">' +
    /** @type {import('../../types/app').LetterLevel[]} */ (['solid', 'learning', 'new'])
      .map((l) => '<span><i class="lv-' + l + '"></i>' + t(`lv.${l}`) + ' (' + lv[l] + ')</span>')
      .join('') +
    '</div>';
  /* every character, by mastery */
  h +=
    '<details class="more fold"><summary>' +
    t('pg.map') +
    '</summary><p class="small muted">' +
    t('pg.mapIntro') +
    '</p><div class="legend"><span><i class="lv-cl"></i>' +
    t('cl.done') +
    ' (' +
    nCl +
    ')</span></div>';
  /** @type {[string, string[]][]} */ ([
    [t('chart.basic'), A46],
    [t('chart.dak'), DAK25],
    [t('chart.yoon'), YOON33],
  ]).forEach(([title, list]) => {
    h +=
      '<p class="small mapt">' +
      title +
      '</p><div class="cmap' +
      (list === YOON33 ? ' yo' : '') +
      '">' +
      list
        .map(
          (k) =>
            '<button class="lv-' +
            level(k) +
            (isComplete(k) ? ' cl' : '') +
            '" data-open="' +
            k +
            '" title="' +
            k +
            ' ' +
            rom(k) +
            ': ' +
            t(`lv.${level(k)}`) +
            '">' +
            k +
            '</button>',
        )
        .join('') +
      '</div>';
  });
  h += '</details>';
  /* last 28 days */
  const start = addDays(todayISO(), -27);
  /** @type {{d: string, n: number}[]} */
  const cells = [];
  for (let i = 0; i < 28; i++) {
    const d = addDays(start, i),
      n = state.act[d] || 0;
    cells.push({ d, n });
  }
  /** @param {number} n */
  const lvl = (n) => (n === 0 ? 0 : n < 10 ? 1 : n < 30 ? 2 : n < 60 ? 3 : 4);
  h +=
    '<h3>' +
    t('pg.activity') +
    '</h3><div class="cal" role="img" aria-label="' +
    t('pg.activity') +
    ': ' +
    t('pg.calSum', { n: cells.filter((c) => c.n).length }) +
    '">' +
    cells
      .map(
        (c) =>
          '<i class="a' +
          lvl(c.n) +
          (c.d === todayISO() ? ' today' : '') +
          '" title="' +
          fmt(c.d) +
          ': ' +
          t('pg.actN', { n: c.n }) +
          '"></i>',
      )
      .join('') +
    '</div>';
  h +=
    '<div class="calx small muted"><span>' +
    fmt(start) +
    '</span><span>' +
    fmt(todayISO()) +
    '</span></div><p class="small muted">' +
    t('pg.actLegend') +
    '</p>';
  /* recent drill rounds */
  const rd = (state.rounds || []).slice(-14);
  h += '<h3>' + t('pg.rounds') + '</h3>';
  if (!rd.length) h += '<p class="small muted">' + t('pg.noRounds') + '</p>';
  else {
    h +=
      '<div class="rounds" role="img" aria-label="' +
      t('pg.rounds') +
      ': ' +
      rd.map((x) => x.p + '%').join(', ') +
      '"><span class="goal" style="bottom:90%"></span>' +
      rd
        .map(
          (x) =>
            '<i style="height:' +
            Math.max(2, x.p) +
            '%" title="' +
            t('pg.roundTip', { date: fmt(x.d), n: x.n, p: x.p }) +
            '"></i>',
        )
        .join('') +
      '</div>';
    h += '<p class="small muted">' + t('pg.roundsNote') + '</p>';
  }
  /* roadmap */
  /** Milestones measured in letters carry their own count; the others count plan days done. */
  /** @type {{k: 'm1' | 'm2' | 'm3' | 'm4' | 'm5' | 'm6', b: number[], v?: number, m?: number, sub?: import('../../types/app').TextKey}[]} */
  const milestones = [
    { k: 'm1', b: [1, 2, 3, 4, 5], v: seenIn(A46), m: 46, sub: 'rm.m1d' },
    { k: 'm2', b: [6, 7], v: solidIn(A46), m: 46, sub: 'rm.solidD' },
    { k: 'm3', b: [8], v: solidIn(DAK25), m: 25, sub: 'rm.solidD' },
    { k: 'm4', b: [9], v: solidIn(YOON33), m: 33, sub: 'rm.solidD' },
    { k: 'm5', b: [10, 11, 12] },
    { k: 'm6', b: [13, 14] },
  ];
  const ms = milestones.map((x) => {
    const pd = planDaysFor(x.b);
    const d = pd.length > 1 ? pd[0] + '-' + pd[pd.length - 1] : String(pd[0]);
    if (x.v !== undefined && x.m !== undefined && x.sub)
      return { k: x.k, d, v: x.v, m: x.m, sub: x.sub };
    return { k: x.k, d, v: pd.filter((dn) => state.done[dn]).length, m: pd.length, sub: /** @type {import('../../types/app').TextKey} */ ('rm.daysDone') };
  });
  let cur = ms.findIndex((x) => x.v < x.m);
  h +=
    '<details class="more fold"><summary>' +
    t('pg.road') +
    '</summary><p class="small muted">' +
    t('pg.roadIntro') +
    '</p><ol class="road">';
  ms.forEach((x, i) => {
    const st = x.v >= x.m ? 'done' : i === cur ? 'now' : 'next';
    const pct = Math.round((x.v / x.m) * 100);
    h +=
      '<li class="' +
      st +
      '"><span class="node" aria-hidden="true">' +
      (st === 'done'
        ? '<svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="17" transform="rotate(-110 22 22)"/></svg>'
        : '') +
      '</span><div class="rbody">' +
      '<div class="rhead"><b>' +
      t(`rm.${x.k}`) +
      '</b><span class="small muted">' +
      t(x.d.includes('-') ? 'rm.days' : 'rm.day', { d: x.d }) +
      '</span></div>' +
      '<div class="rbar" role="img" aria-label="' +
      t('rm.of', { v: x.v, m: x.m }) +
      '"><i style="width:' +
      pct +
      '%"></i></div>' +
      '<div class="small"><span class="muted">' +
      t(x.sub) +
      ': </span>' +
      t('rm.of', { v: x.v, m: x.m }) +
      (st === 'done'
        ? ' <span class="tag">' + t('rm.done') + '</span>'
        : st === 'now'
          ? ' <span class="tag now">' + t('rm.now') + '</span>'
          : '') +
      '</div></div></li>';
  });
  h +=
    '<li class="later"><span class="node" aria-hidden="true"></span><div class="rbody"><div class="rhead"><b>' +
    t('rm.kata') +
    '</b><span class="small muted">' +
    t('rm.after') +
    '</span></div><p class="small muted">' +
    t('rm.kataD') +
    '</p></div></li>';
  const rs = goalOf().reason;
  if (rs !== 'all')
    h +=
      '<li class="later"><span class="node" aria-hidden="true"></span><div class="rbody"><div class="rhead"><b>' +
      t(rs === 'jlpt' ? 'rm.n5' : `rm.goal.${rs}`) +
      '</b><span class="small muted">' +
      t(`goal.reason.${rs}`) +
      '</span></div><p class="small muted">' +
      t(rs === 'jlpt' ? 'rm.n5D' : `rm.goalD.${rs}`) +
      '</p></div></li>';
  h += '</ol></details>';
  const root = must('#tab-progress');
  const wasOpen = $$('details', root, HTMLDetailsElement).map((d) => d.open),
    same = root.dataset.rendered === '1';
  root.innerHTML = h;
  root.dataset.rendered = '1';
  if (same)
    $$('details', root, HTMLDetailsElement).forEach((d, i) => {
      if (wasOpen[i]) d.open = true;
    });
  const go = $('#pgToday', root);
  if (go) go.onclick = () => showTab('plan');
}
