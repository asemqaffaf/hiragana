import {markSheetOpen, showTab} from '../core/nav.js';
import {dayNumber, goalOf, planCache} from '../core/plan.js';
import {renderAll} from '../core/render-all.js';
import {level, minutesToday, rowAcc, todayText, weakest} from '../core/stats.js';
import {LANGS, MODES, TINTS, applyTheme, cleanTheme, me, progKey, saveStudents, state, students, syncText} from '../core/storage.js';
import {REASONS, sectionsFor} from '../core/goals.js';
import {ui} from '../core/ui-state.js';
import {PHRASES} from '../data/daily.js';
import {A46, ALL, DROWS, ROWS, YOON33} from '../data/letters.js';
import {startDrill} from './drill.js';
import {BADGES, levelName, levelOf, progressCtx, xpOf} from './gamify.js';
import {langSeg, setLang} from './language.js';
import {avatar, cleanName, nameTaken, renderWho, showLogin, streakOf, swatches, switchStudent} from './login.js';
import {kb, renderPlan} from './plan.js';
import {K, LANG, isAr, t} from '../i18n/core.js';
import {fmt} from '../i18n/helpers.js';
import {closeSheet} from '../ui/sheet.js';
import {$, $$, addDays, esc, todayISO} from '../util.js';

/* ---------- advanced student profile: identity, goals, levels, achievements, detailed stats ---------- */
const AGES = ['child', 'teen', 'adult'], NATIVES = ['ar', 'en', 'ja', 'other'], JLEVELS = ['new', 'some', 'all'];
const PACES = [7, 14, 21], MINS = [10, 20, 30];
export function sel(id, opts, cur, label, hint) {
  return '<label class="field"><span class="small muted">' + label + '</span><select id="' + id + '"' + (hint ? ' aria-describedby="' + id + 'Hint"' : '') + '>' + opts.map(o => '<option value="' + o[0] + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' + (hint ? '<span class="small muted goalhint" id="' + id + 'Hint" aria-live="polite">' + hint + '</span>' : '') + '</label>';
}
export const paceOpts = () => PACES.map(x => [x, t('pace.' + x)]);
export const minOpts = () => MINS.map(x => [x, t('min.n', {n: x})]);
export const ageOpts = () => AGES.map(x => [x, t('age.' + x)]);
export const jlOpts = () => JLEVELS.map(x => [x, t('jl.' + x)]);
export const reasonOpts = () => REASONS.map(x => [x, t('goal.reason.' + x)]);
/* under the "Why are you learning?" box: which phrase sections that goal opens (all of them for Everything) */
export const goalHint = r => r === 'all' ? t('goal.hintAll') : t('goal.hint', {list: sectionsFor(r, PHRASES).map(g => isAr() ? g.ar : g.en).join(isAr() ? '، ' : ', ')});
document.addEventListener('change', e => { const s = e.target; if (s && (s.id === 'pfReason' || s.id === 'nsReason')) { const h = document.getElementById(s.id + 'Hint'); if (h) h.textContent = goalHint(s.value); } });
/* shrink a photo to a 160 px square JPEG so it fits comfortably in localStorage */
function photoToDataUrl(file) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.naturalWidth, img.naturalHeight), c = document.createElement('canvas'); c.width = c.height = 160;
      c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 160, 160);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad image')); };
    img.src = url;
  });
}
let pfMsg = '', pfDelArmed = false, pendingPhoto = null;
export function renderProfile() {
  const p = me(); if (!p) return;
  const g = goalOf(p), c = progressCtx(), xp = xpOf(c), lv = levelOf(xp), av = p.av || {t: 'initial'};
  let h = '<div class="phero">' + avatar(p, 'xl') + '<div><h2 dir="auto">' + esc(p.name) + '</h2><p class="lvname">' + t('pf.level', {n: lv.n, name: levelName(lv.n)}) + '</p>';
  h += '<div class="xpbar" role="img" aria-label="' + (lv.to ? t('pf.xp', {xp, left: lv.to - xp, next: lv.n + 1}) : t('pf.xpMax', {xp})) + '"><i style="width:' + (lv.to ? Math.round((xp - lv.from) / (lv.to - lv.from) * 100) : 100) + '%"></i></div>';
  h += '<p class="small muted">' + (lv.to ? t('pf.xp', {xp, left: lv.to - xp, next: lv.n + 1}) : t('pf.xpMax', {xp})) + '</p></div></div>';
  h += '<details class="more"><summary>' + t('pf.xpHowT') + '</summary><p class="small">' + t('pf.xpHow') + '</p></details>';
  /* today */
  const m = minutesToday();
  h += '<h3>' + t('pf.today') + '</h3><div class="goalbar" role="img" aria-label="' + todayText() + '"><i style="width:' + Math.min(100, Math.round(m / g.min * 100)) + '%"></i></div>';
  h += '<p class="small"><span id="todayMin">' + todayText() + '</span>. ' + t('pf.streakNow', {n: streakOf(state.act)}) + '</p><p class="small muted">' + t('pf.todayNote') + '</p>';
  /* achievements */
  const earned = BADGES.filter(b => (state.badges || {})[b.id]).length;
  h += '<h3>' + t('pf.badges') + ' <span class="muted small">' + t('pf.badgesN', {n: earned, m: BADGES.length}) + '</span></h3><div class="badges">';
  h += BADGES.map(b => { const d = (state.badges || {})[b.id]; return '<div class="badge' + (d ? ' got' : '') + '"><span class="bk" aria-hidden="true">' + b.k + '</span><b>' + t('b.' + b.id) + '</b><span class="small muted">' + (d ? t('pf.earnedOn', {date: fmt(d)}) : t('bd.' + b.id)) + '</span></div>'; }).join('') + '</div>';
  /* detailed stats */
  h += '<h3>' + t('pf.stats') + '</h3>';
  const wk = weakest(8);
  h += '<h4>' + t('pf.weak') + '</h4>' + (wk.length ? '<div class="missed">' + wk.map(k => kb(k)).join('') + '</div><div class="btnrow"><button class="btn primary" id="pfDrillWeak">' + t('pf.drillThese') + '</button></div>' : '<p class="small muted">' + t('pf.weakNone') + '</p>');
  const groups = ROWS.map(r => [r.kana[0], r.kana.filter(Boolean)]).concat(DROWS.map(r => [r.kana[0], r.kana]), [['きゃ…', YOON33]]);
  h += '<h4>' + t('pf.rows') + '</h4><div class="racc">' + groups.map(([lab, list]) => { const v = rowAcc(list); return '<div class="rr"><span class="kana">' + lab + '</span><span class="rbar"><i style="width:' + (v || 0) + '%"></i></span><span class="small' + (v === null ? ' muted' : '') + '">' + (v === null ? t('pf.rowNone') : v + '%') + '</span></div>'; }).join('') + '</div>';
  const ts = Object.values(state.stats).map(s => s.t).filter(x => x > 0);
  h += '<h4>' + t('pf.speed') + '</h4><p class="small">' + (ts.length ? t('pf.speedV', {s: (ts.reduce((x, y) => x + y, 0) / ts.length / 1000).toFixed(1)}) : t('none')) + '</p>';
  const last7 = Array.from({length: 7}, (_, i) => addDays(todayISO(), i - 6)).map(d => ({d, m: Math.floor(((state.time || {})[d] || 0) / 60)}));
  const top = Math.max(g.min, ...last7.map(x => x.m));
  h += '<h4>' + t('pf.minutes') + '</h4><div class="rounds mins" role="img" aria-label="' + t('pf.minutes') + ': ' + last7.map(x => x.m).join(', ') + '"><span class="goal" style="bottom:' + Math.round(g.min / top * 100) + '%"></span>' + last7.map(x => '<i style="height:' + Math.max(2, Math.round(x.m / top * 100)) + '%" title="' + fmt(x.d) + ': ' + x.m + '"></i>').join('') + '</div>';
  h += '<div class="calx small muted"><span>' + fmt(last7[0].d) + '</span><span>' + fmt(last7[6].d) + '</span></div><p class="small muted">' + t('pf.minNote', {g: g.min}) + '</p>';
  const mix = Object.entries(state.mix || {}).sort((x, y) => y[1] - x[1]).slice(0, 5);
  h += '<h4>' + t('pf.mix') + '</h4>' + (mix.length ? '<ul class="mixl">' + mix.map(([key, n]) => { const [x, y] = key.split('>'); return '<li>' + t('pf.mixRow', {a: '<button class="link" data-open="' + x + '">' + K(x) + '</button>', b: '<button class="link" data-open="' + y + '">' + K(y) + '</button>', n}) + '</li>'; }).join('') + '</ul>' : '<p class="small muted">' + t('pf.mixNone') + '</p>');
  /* appearance: applied at once and saved with the student */
  const th = cleanTheme(p.theme);
  /* [paper, surface, grid] for light, then for dark, so each preview matches the mode in use */
  const TC = {sage: ['#F5F7F3', '#FFFFFF', '#B7D2C8', '#15221D', '#1B2B25', '#3A5A4F'], sand: ['#F8F4EC', '#FFFFFF', '#D8CDB4', '#211C14', '#2A241A', '#5A4D36'], sky: ['#F1F6FA', '#FFFFFF', '#B4CADB', '#121D28', '#192733', '#3A5870'], rose: ['#FBF3F2', '#FFFFFF', '#E0BDB8', '#241A1B', '#2E2223', '#5E4040'], lilac: ['#F5F3FA', '#FFFFFF', '#C8C0DD', '#1B1826', '#241F32', '#4E4670'], slate: ['#F3F4F5', '#FFFFFF', '#BCC3C9', '#17191C', '#1F2226', '#474D55'], white: ['#FFFFFF', '#F6F7F5', '#C3D3CC', '#000000', '#111513', '#3A4A43']};
  h += '<h3>' + t('pf.look') + '</h3><div class="themebox"><span class="small muted">' + t('th.mode') + '</span><div class="seg" role="group" aria-label="' + t('th.mode') + '">' + MODES.map(m => '<button type="button" data-mode="' + m + '" aria-pressed="' + (th.mode === m) + '">' + t('th.' + m) + '</button>').join('') + '</div>';
  h += '<fieldset class="tints"><legend class="small muted">' + t('th.bg') + '</legend><div class="tintgrid">' + TINTS.map(k => '<label class="tint"><input type="radio" name="pfTint" value="' + k + '"' + (th.tint === k ? ' checked' : '') + '><span class="tp" style="--c:' + TC[k][0] + ';--s:' + TC[k][1] + ';--g:' + TC[k][2] + ';--cd:' + TC[k][3] + ';--sd:' + TC[k][4] + ';--gd:' + TC[k][5] + '"></span><span>' + t('th.' + k) + '</span></label>').join('') + '</div></fieldset><p class="small muted">' + t('th.note') + '</p></div>';
  /* details and goals */
  h += '<h3>' + t('pf.details') + '</h3><form id="pfForm" class="sform pform" novalidate autocomplete="off">';
  h += '<label class="field"><span class="small muted">' + t('f.name') + '</span><input id="pfName" maxlength="24" dir="auto" value="' + esc(p.name) + '"></label>';
  h += '<fieldset class="avpick"><legend class="small muted">' + t('f.avatar') + '</legend>' + ['initial', 'kana', 'photo'].map(x => '<label><input type="radio" name="pfAv" value="' + x + '"' + (av.t === x ? ' checked' : '') + '> ' + t('av.' + x) + '</label>').join('') + '</fieldset>';
  h += '<div class="avopts"><label class="field avk"><span class="small muted">' + t('av.kana') + '</span><select id="pfKana">' + A46.map(k => '<option' + (av.k === k ? ' selected' : '') + '>' + k + '</option>').join('') + '</select></label>';
  h += '<div class="field avp"><button class="btn" type="button" id="pfPhotoBtn">' + t('av.upload') + '</button><input type="file" id="pfPhoto" accept="image/*" hidden><span class="small muted">' + t('av.note') + '</span></div></div>';
  h += swatches('pfColor', p.color);
  h += '<div class="fgrid">' + sel('pfAge', ageOpts(), p.age || 'adult', t('f.age')) + sel('pfNative', NATIVES.map(x => [x, t('nat.' + x)]), p.native || (LANG === 'ar' ? 'ar' : 'en'), t('f.native'))
    + sel('pfJl', jlOpts(), p.jlevel || 'new', t('f.jlevel')) + sel('pfLang', LANGS.map(x => [x, t('lang.' + x)]), p.lang || LANG, t('f.uiLang'))
    + sel('pfRate', [[1, t('rate.1')], [0.75, t('rate.slow')]], p.rate === 0.75 ? 0.75 : 1, t('f.rate')) + sel('pfReason', reasonOpts(), g.reason, t('f.reason'), goalHint(g.reason))
    + sel('pfPace', paceOpts(), g.pace, t('f.pace')) + sel('pfMin', minOpts(), g.min, t('f.min')) + '</div>';
  h += '<p class="small muted">' + t('pace.change') + '</p><p class="fmsg" id="pfMsg" role="alert">' + esc(pfMsg) + '</p>';
  h += '<div class="btnrow"><button class="btn primary" type="submit">' + t('pf.save') + '</button></div></form>';
  /* data */
  h += '<h3>' + t('pf.data') + '</h3><p class="small muted">' + syncText() + '</p>';
  h += '<div class="btnrow"><button class="btn" id="pExport">' + t('p.export') + '</button><button class="btn primary" id="pSwitch">' + t('p.switch') + '</button></div>';
  h += '<div class="btnrow"><button class="btn red" id="pDelete">' + (pfDelArmed ? t('p.deleteConfirm', {name: esc(p.name)}) : t('p.delete')) + '</button></div>';
  const root = $('#tab-profile');
  root.innerHTML = h;
  pfMsg = '';
  const setTheme = patch => { p.theme = Object.assign(cleanTheme(p.theme), patch); applyTheme(p.theme, true); saveStudents(); };
  $$('[data-mode]', root).forEach(b => b.onclick = () => { setTheme({mode: b.dataset.mode}); $$('[data-mode]', root).forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
  $$('input[name="pfTint"]', root).forEach(r => r.onchange = () => setTheme({tint: r.value}));
  const syncAv = () => { const v = (root.querySelector('input[name="pfAv"]:checked') || {}).value; root.querySelector('.avk').hidden = v !== 'kana'; root.querySelector('.avp').hidden = v !== 'photo'; };
  $$('input[name="pfAv"]', root).forEach(r => r.onchange = syncAv); syncAv();
  $('#pfPhotoBtn', root).onclick = () => $('#pfPhoto', root).click();
  $('#pfPhoto', root).onchange = async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { pendingPhoto = await photoToDataUrl(f); $('#pfPhotoBtn', root).textContent = t('av.ready'); }
    catch (err) { $('#pfMsg', root).textContent = t('av.bad'); }
  };
  $('#pfForm', root).onsubmit = e => {
    e.preventDefault();
    const name = cleanName($('#pfName', root).value), msg = $('#pfMsg', root);
    if (!name) { msg.textContent = t('err.noName'); return; }
    if (nameTaken(name, p.id)) { msg.textContent = t('err.taken2', {name}); return; }
    const avT = (root.querySelector('input[name="pfAv"]:checked') || {}).value || 'initial';
    if (avT === 'photo' && !pendingPhoto && !(p.av && p.av.img)) { msg.textContent = t('av.need'); return; }
    p.name = name;
    p.color = (root.querySelector('input[name="pfColor"]:checked') || {}).value || p.color;
    p.av = {t: avT, k: $('#pfKana', root).value, img: avT === 'photo' ? (pendingPhoto || p.av.img) : ''};
    p.age = $('#pfAge', root).value; p.native = $('#pfNative', root).value; p.jlevel = $('#pfJl', root).value;
    p.rate = +$('#pfRate', root).value === 0.75 ? 0.75 : 1;
    p.goal = {pace: +$('#pfPace', root).value, min: +$('#pfMin', root).value, reason: $('#pfReason', root).value};
    p.lang = $('#pfLang', root).value;
    pendingPhoto = null;
    saveStudents(); setLang(p.lang); applyStudent();
    renderWho(); renderAll(); pfMsg = t('pf.saved'); renderProfile();
    const m2 = $('#pfMsg'); if (m2) { m2.classList.add('ok'); m2.scrollIntoView({block: 'center'}); }
  };
  const dw = $('#pfDrillWeak', root);
  if (dw) dw.onclick = () => { ui.drillMode = 'read'; ui.session = null; startDrill(wk); showTab('drill'); };
  $('#pExport', root).onclick = exportStudent;
  $('#pSwitch', root).onclick = () => { pfDelArmed = false; switchStudent(); };
  $('#pDelete', root).onclick = () => {
    if (!pfDelArmed) { pfDelArmed = true; renderProfile(); setTimeout(() => { if (pfDelArmed) { pfDelArmed = false; if (ui.currentTab === 'profile') renderProfile(); } }, 5000); return; }
    pfDelArmed = false;
    try { localStorage.removeItem(progKey(p.id)); } catch (e) {}
    students.list = students.list.filter(x => x.id !== p.id);
    students.current = null; saveStudents(); ui.loginMsg = ''; showLogin();
  };
}
/* settings that change how the whole app behaves for this student */
export function applyStudent() {
  const p = me(); if (!p) return;
  const g = goalOf(p);
  document.body.classList.toggle('kid', p.age === 'child');
  applyTheme(p.theme, true);
  $('#appSub').textContent = t('app.subP', {days: g.pace, min: g.min});
  planCache.key = '';
}
let profileEdit = false, delArmed = false, delTimer = null;
function exportStudent() {
  const p = me();
  if (!p) return;
  const data = {app: 'hiragana14', kind: 'student', v: 1, exported: new Date().toISOString(), student: {name: p.name, color: p.color, created: p.created, lang: p.lang || LANG, age: p.age, native: p.native, jlevel: p.jlevel, rate: p.rate, goal: p.goal, av: p.av, theme: p.theme}, progress: state};
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], {type: 'application/json'}));
  const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'student';
  const a = document.createElement('a');
  a.href = url; a.download = 'hiragana-' + slug + '-' + todayISO() + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function openProfile() {
  const p = me();
  if (!p) return;
  if (!$('#sheetRoot').innerHTML) ui.lastFocus = document.activeElement;
  const counts = {solid: 0, learning: 0, 'new': 0};
  ALL.forEach(k => counts[level(k)]++);
  let ans = 0, right = 0, wn = 0, wp = 0;
  Object.values(state.stats).forEach(s => { ans += s.c + s.w; right += s.c; });
  Object.values(state.ws).forEach(w => { wn += w.n; wp += w.p; });
  const days = Object.keys(state.act).length, streak = streakOf(state.act), n = dayNumber(), doneDays = Object.keys(state.done).length;
  const rows = [
    [t('p.plan'), n < 1 ? t('p.planStarts', {date: fmt(state.start, true)}) : n > 14 ? t('p.planDone', {date: fmt(state.start, true), d: doneDays}) : t('p.planDay', {n, d: doneDays})],
    [t('p.chars'), t('counts', {s: counts.solid, l: counts.learning, n: counts['new']})],
    [t('p.answers'), ans ? t('p.answersV', {n: ans, p: Math.round(right / ans * 100)}) : t('none')],
    [t('p.writing'), wn ? t('p.writingV', {n: wn, p: wp}) : t('none')],
    [t('p.days'), days ? t('p.daysV', {d: days, s: streak}) : t('none')],
    [t('p.created'), fmt(p.created, true)]
  ];
  let h = '<div class="scrim" data-close></div><div class="sheet" role="dialog" aria-modal="true" aria-label="' + t('p.dialog') + '"><div class="in"><div class="grab"></div>';
  if (profileEdit) {
    h += '<h2>' + t('p.edit') + '</h2><form id="editStudent" class="sform" novalidate autocomplete="off"><label class="field"><span class="small muted">' + t('f.name') + '</span><input id="esName" maxlength="24" dir="auto" value="' + esc(p.name) + '" spellcheck="false"></label>' + swatches('esColor', p.color) + '<p class="fmsg" id="esMsg" role="alert"></p><div class="btnrow"><button class="btn primary" type="submit">' + t('p.save') + '</button><button class="btn" type="button" id="esCancel">' + t('p.cancel') + '</button></div></form>';
  } else {
    h += '<div class="phead">' + avatar(p, 'lg') + '<h2 dir="auto">' + esc(p.name) + '</h2></div>';
    h += '<dl class="pstats">' + rows.map(r => '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>').join('') + '</dl>';
    h += '<div class="langrow"><span class="small muted">' + t('lang') + '</span>' + langSeg(p.lang || LANG, '') + '</div>';
    h += '<div class="btnrow"><button class="btn" id="pEdit">' + t('p.edit') + '</button><button class="btn primary" id="pSwitch">' + t('p.switch') + '</button></div>';
    h += '<div class="btnrow"><button class="btn" id="pExport">' + t('p.export') + '</button><button class="btn red" id="pDelete">' + (delArmed ? t('p.deleteConfirm', {name: esc(p.name)}) : t('p.delete')) + '</button></div>';
    h += '<p class="small muted" style="margin-top:12px">' + syncText() + '</p>';
    h += '<div class="btnrow"><button class="btn" data-close>' + t('close') + '</button></div>';
  }
  h += '</div></div>';
  const root = $('#sheetRoot');
  root.innerHTML = h;
  markSheetOpen();
  $$('[data-close]', root).forEach(b => b.onclick = () => { profileEdit = false; delArmed = false; closeSheet(); });
  if (profileEdit) {
    const nm = $('#esName', root);
    $('#editStudent', root).onsubmit = e => {
      e.preventDefault();
      const name = cleanName(nm.value), msg = $('#esMsg', root);
      if (!name) { msg.textContent = t('err.noName'); nm.focus(); return; }
      if (nameTaken(name, p.id)) { msg.textContent = t('err.taken2', {name}); nm.focus(); return; }
      p.name = name;
      p.color = (root.querySelector('input[name="esColor"]:checked') || {}).value || p.color;
      saveStudents(); renderWho(); renderPlan();
      profileEdit = false; openProfile();
    };
    $('#esCancel', root).onclick = () => { profileEdit = false; openProfile(); };
    nm.focus();
    return;
  }
  $$('[data-lang]', root).forEach(b => b.onclick = () => {
    p.lang = b.dataset.lang; saveStudents(); setLang(p.lang);
    renderWho(); renderAll(); openProfile();
  });
  $('#pEdit', root).onclick = () => { profileEdit = true; delArmed = false; openProfile(); };
  $('#pSwitch', root).onclick = () => { delArmed = false; switchStudent(); };
  $('#pExport', root).onclick = exportStudent;
  $('#pDelete', root).onclick = () => {
    if (!delArmed) {
      delArmed = true; openProfile(); $('#pDelete').focus();
      clearTimeout(delTimer); delTimer = setTimeout(() => { if (delArmed) { delArmed = false; if ($('#pDelete')) openProfile(); } }, 5000);
      return;
    }
    delArmed = false; clearTimeout(delTimer);
    try { localStorage.removeItem(progKey(p.id)); } catch (e) {}
    students.list = students.list.filter(x => x.id !== p.id);
    students.current = null; saveStudents();
    ui.loginMsg = '';
    showLogin();
  };
  $('#pSwitch', root).focus({preventScroll: true});
}
