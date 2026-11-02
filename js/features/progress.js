import { PL, PLEN, dayNumber, goalOf, planDaysFor } from '../core/plan.js';
import { showTab } from '../core/nav.js';
import { level, minutesToday, streakOf, todayText, weakest } from '../core/stats.js';
import { me, state } from '../core/store.js';
import { ui } from '../core/ui-state.js';
import { BADGES, levelName, levelOf, progressCtx, xpOf } from './gamify.js';
import { startDrill } from './drill.js';
import { kb } from '../ui/letter-button.js';
import { moveThumb } from '../ui/thumb.js';
import { A46, ALL, DAK25, YOON33, rom } from '../data/letters.js';
import { isComplete } from '../core/progress.js';
import { K, t } from '../i18n/core.js';
import { fmt } from '../i18n/helpers.js';
import { $, $$, addDays, entriesOf, esc, must, todayISO, valuesOf } from '../util.js';

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
  const xp0 = xpOf(progressCtx()),
    lvl0 = levelOf(xp0);
  let h = '<h2>' + t('tab.progress') + '</h2>';
  /* where you are: one card with the day, the lessons finished, and the way to the next step */
  h +=
    '<section class="pghero"><p class="pbig">' +
    t('pg.lessonsBig', { v: doneDays, m: total }) +
    '</p><div class="rbar" role="img" aria-label="' +
    t('pg.lessonsBig', { v: doneDays, m: total }) +
    '"><i style="width:' +
    Math.round((doneDays / total) * 100) +
    '%"></i></div><p class="small">' +
    (today < 1
      ? t('plan.starts', { date: fmt(state.start) })
      : today > total
        ? t('plan.complete')
        : t('pg.todayIs', { n: today })) +
    (streak > 1 ? ' ' + t('pg.streakLine', { n: streak }) : '') +
    '</p><p class="small muted">' +
    t('pf.level', { n: lvl0.n, name: levelName(lvl0.n) }) +
    '. ' +
    (lvl0.to ? t('pf.xp', { xp: xp0, left: lvl0.to - xp0, next: lvl0.n + 1 }) : t('pf.xpMax', { xp: xp0 })) +
    '</p>' +
    (today >= 1 && today <= total
      ? '<div class="btnrow"><button class="btn primary" id="pgToday">' +
        t('pg.goToday') +
        '</button></div>'
      : '') +
    '</section>';
  /* the lessons: finished ones, today's, and what comes next */
  /** @param {number} dn */
  const lessonRow = (dn) => {
    const pl = PL()[dn - 1],
      doneOn = state.done[dn],
      st = doneOn ? 'done' : dn === today ? 'now' : dn < today ? 'open' : 'up';
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
      '</span></span></li>'
    );
  };
  const finished = Array.from({ length: total }, (_, i) => i + 1).filter((dn) => state.done[dn]);
  const near = Array.from({ length: total }, (_, i) => i + 1).filter(
    (dn) => finished.slice(-2).includes(dn) || dn === today,
  );
  const rest = Array.from({ length: total }, (_, i) => i + 1).filter((dn) => !near.includes(dn));
  h +=
    '<h3>' +
    t('pg.lessons') +
    '</h3><p class="small muted">' +
    t('pg.lessonsIntro') +
    '</p><ol class="lessons">' +
    near.map(lessonRow).join('') +
    '</ol>';
  let hAll = '', hL = '', hA = '', hMap = '';
  if (rest.length)
    hAll +=
      '<section class="pgsub"><h4>' +
      t('pg.lessonAll', { total }) +
      '</h4><ol class="lessons">' +
      Array.from({ length: total }, (_, i) => i + 1)
        .map(lessonRow)
        .join('') +
      '</ol></section>';
  /* letters, grouped */
  const nCl = Object.keys(state.cl || {}).length;
  /** @type {[string, string[]][]} */
  const groups = [
    [t('chart.basic'), A46],
    [t('chart.dak'), DAK25],
    [t('chart.yoon'), YOON33],
  ];
  hL +=
    '<section class="pgsub"><h4>' +
    t('pg.letters') +
    '</h4><p class="small muted">' +
    t('pg.lettersIntro', { v: lv.solid }) +
    '</p><div class="groups">';
  groups.forEach(([title, list]) => {
    const so = solidIn(list),
      le = list.filter((k) => level(k) === 'learning').length;
    hL +=
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
  hL +=
    '</div><div class="legend">' +
    /** @type {import('../../types/app').LetterLevel[]} */ (['solid', 'learning', 'new'])
      .map((l) => '<span><i class="lv-' + l + '"></i>' + t(`lv.${l}`) + ' (' + lv[l] + ')</span>')
      .join('') +
    '</div>';
  /* every character, by mastery */
  hMap +=
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
    hMap +=
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
  hMap += '</details>';
  hL += '</section>';
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
  hA +=
    '<section class="pgsub"><h4>' +
    t('pg.activity') +
    '</h4><p class="small muted">' +
    t('pg.calLine', { n: cells.filter((c) => c.n).length }) +
    '</p><div class="cal" role="img" aria-label="' +
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
  hA +=
    '<div class="calx small muted"><span>' +
    fmt(start) +
    '</span><span>' +
    fmt(todayISO()) +
    '</span></div><p class="small muted">' +
    t('pg.actLegend') +
    '</p></section>';
  /* recent drill rounds */
  const rd = (state.rounds || []).slice(-14);
  hA += '<section class="pgsub"><h4>' + t('pg.rounds') + '</h4>';
  if (!rd.length) hA += '<p class="small muted">' + t('pg.noRounds') + '</p>';
  else {
    hA +=
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
    hA += '<p class="small muted">' + t('pg.roundsNote') + '</p>';
  }
  hA += '</section>';
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
    return {
      k: x.k,
      d,
      v: pd.filter((dn) => state.done[dn]).length,
      m: pd.length,
      sub: /** @type {import('../../types/app').TextKey} */ ('rm.daysDone'),
    };
  });
  let cur = ms.findIndex((x) => x.v < x.m);
  hAll +=
    '<section class="pgsub"><h4>' +
    t('pg.road') +
    '</h4><p class="small muted">' +
    t('pg.roadIntro') +
    '</p><ol class="road">';
  ms.forEach((x, i) => {
    const st = x.v >= x.m ? 'done' : i === cur ? 'now' : 'next';
    const pct = Math.round((x.v / x.m) * 100);
    hAll +=
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
  hAll +=
    '<li class="later"><span class="node" aria-hidden="true"></span><div class="rbody"><div class="rhead"><b>' +
    t('rm.kata') +
    '</b><span class="small muted">' +
    t('rm.after') +
    '</span></div><p class="small muted">' +
    t('rm.kataD') +
    '</p></div></li>';
  const rs = goalOf().reason;
  if (rs !== 'all')
    hAll +=
      '<li class="later"><span class="node" aria-hidden="true"></span><div class="rbody"><div class="rhead"><b>' +
      t(rs === 'jlpt' ? 'rm.n5' : `rm.goal.${rs}`) +
      '</b><span class="small muted">' +
      t(`goal.reason.${rs}`) +
      '</span></div><p class="small muted">' +
      t(rs === 'jlpt' ? 'rm.n5D' : `rm.goalD.${rs}`) +
      '</p></div></li>';
  hAll += '</ol></section>';
  /* letters to work on, the day's minutes and the awards: these used to sit on the Profile page */
  const wk = weakest(8);
  const hW =
    '<section class="pgsub"><h4>' +
    t('pf.weak') +
    '</h4>' +
    (wk.length
      ? '<div class="missed">' +
        wk.map((k) => kb(k)).join('') +
        '</div><div class="btnrow"><button class="btn primary" id="pfDrillWeak">' +
        t('pf.drillThese') +
        '</button></div>'
      : '<p class="small muted">' + t('pf.weakNone') + '</p>') +
    '</section>';
  const goalMin = goalOf().min;
  const hT =
    '<section class="pgsub"><h4>' +
    t('pf.today') +
    '</h4><div class="goalbar" role="img" aria-label="' +
    todayText() +
    '"><i style="width:' +
    Math.min(100, Math.round((minutesToday() / goalMin) * 100)) +
    '%"></i></div><p class="small"><span id="todayMin">' +
    todayText() +
    '</span>. ' +
    t('pf.streakNow', { n: streak }) +
    '</p><p class="small muted">' +
    t('pf.todayNote') +
    '</p></section>';
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(todayISO(), i - 6)).map((d) => ({
    d,
    m: Math.floor((state.time[d] || 0) / 60),
  }));
  const top = Math.max(goalMin, ...last7.map((x) => x.m));
  const hM =
    '<section class="pgsub"><h4>' +
    t('pf.minutes') +
    '</h4><div class="rounds mins" role="img" aria-label="' +
    t('pf.minutes') +
    ': ' +
    last7.map((x) => x.m).join(', ') +
    '"><span class="goal" style="bottom:' +
    Math.round((goalMin / top) * 100) +
    '%"></span>' +
    last7
      .map(
        (x) =>
          '<i style="height:' +
          Math.max(2, Math.round((x.m / top) * 100)) +
          '%" title="' +
          fmt(x.d) +
          ': ' +
          x.m +
          '"></i>',
      )
      .join('') +
    '</div><div class="calx small muted"><span>' +
    fmt(last7[0].d) +
    '</span><span>' +
    fmt(last7[6].d) +
    '</span></div></section>';
  const mix = entriesOf(state.mix)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 3);
  const hX = mix.length
    ? '<section class="pgsub"><h4>' +
      t('pf.mix') +
      '</h4><ul class="mixl">' +
      mix
        .map(([key, n]) => {
          const [x, y] = key.split('>');
          return (
            '<li>' +
            t('pf.mixRow', {
              a: '<button class="link" data-open="' + x + '">' + K(x) + '</button>',
              b: '<button class="link" data-open="' + y + '">' + K(y) + '</button>',
              n,
            }) +
            '</li>'
          );
        })
        .join('') +
      '</ul></section>'
    : '';
  const earned = BADGES.filter((b) => state.badges[b.id]).length;
  const hB =
    '<section class="pgsub"><h4>' +
    t('pf.badges') +
    ' <span class="muted small">' +
    t('pf.badgesN', { n: earned, m: BADGES.length }) +
    '</span></h4><div class="badges">' +
    BADGES.map((b) => {
      const d = state.badges[b.id];
      return (
        '<div class="badge' +
        (d ? ' got' : '') +
        '"><span class="bk" aria-hidden="true">' +
        b.k +
        '</span><b>' +
        t(`b.${b.id}`) +
        '</b><span class="small muted">' +
        (d ? t('pf.earnedOn', { date: fmt(d) }) : t(`bd.${b.id}`)) +
        '</span></div>'
      );
    }).join('') +
    '</div></section>';
  /* one panel at a time, chosen with a segmented control */
  /** @type {{id: 'letters' | 'activity' | 'awards', label: import('../../types/app').TextKey, html: string}[]} */
  const panels = [
    { id: 'letters', label: 'pg.tabLetters', html: hL + hW + hX + hMap },
    { id: 'activity', label: 'pg.tabActivity', html: hT + hM + hA },
    { id: 'awards', label: 'pg.tabAwards', html: hB },
  ];
  h +=
    '<div class="seg pgseg" role="tablist" aria-label="' +
    t('tab.progress') +
    '">' +
    panels
      .map(
        (x) =>
          '<button type="button" role="tab" data-pgtab="' +
          x.id +
          '" aria-selected="' +
          (ui.pgTab === x.id) +
          '" aria-pressed="' +
          (ui.pgTab === x.id) +
          '">' +
          t(x.label) +
          '</button>',
      )
      .join('') +
    '</div>' +
    panels
      .map((x) => '<div class="pgpanel" data-panel="' + x.id + '"' + (ui.pgTab === x.id ? '' : ' hidden') + '>' + x.html + '</div>')
      .join('');
  h +=
    '<details class="more fold"><summary>' +
    t('pg.lessonAll', { total }) +
    '</summary>' +
    hAll +
    '</details>';
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
  const seg = $('.pgseg', root);
  moveThumb(seg, 'pgseg', !same);
  $$('[data-pgtab]', root).forEach(
    (b) =>
      (b.onclick = () => {
        const id = b.dataset.pgtab;
        if (id !== 'letters' && id !== 'activity' && id !== 'awards') return;
        ui.pgTab = id;
        $$('[data-pgtab]', root).forEach((x) => {
          const on = x === b;
          x.setAttribute('aria-selected', String(on));
          x.setAttribute('aria-pressed', String(on));
        });
        $$('.pgpanel', root).forEach((x) => (x.hidden = x.dataset.panel !== id));
        moveThumb(seg, 'pgseg');
      }),
  );
  const dw = $('#pfDrillWeak', root);
  if (dw)
    dw.onclick = () => {
      ui.drillMode = 'read';
      ui.session = null;
      startDrill(wk);
      showTab('drill');
    };
}
