import { showTab } from '../core/nav.js';
import { goalOf } from '../core/plan.js';
import { renderAll } from '../core/render-all.js';
import { minutesToday, rowAcc, streakOf, todayText, weakest } from '../core/stats.js';
import {
  MODES,
  TINTS,
  cleanTheme,
  me,
  removeStudent,
  state,
  updateStudent,
} from '../core/store.js';
import { ui } from '../core/ui-state.js';
import { A46, DROWS, ROWS, YOON33, kanaOf } from '../data/letters.js';
import { startDrill } from './drill.js';
import { BADGES, levelName, levelOf, progressCtx, xpOf } from './gamify.js';
import { setLang } from './language.js';
import { renderWho, showLogin, switchStudent } from './login.js';
import { avatar, cleanName, nameTaken, swatches, syncText } from '../ui/student.js';
import {
  ageOpts,
  goalHint,
  jlOpts,
  languageOpts,
  minOpts,
  nativeOpts,
  paceOpts,
  rateOpts,
  reasonOpts,
  sel,
} from '../ui/profile-fields.js';
import { applyStudent, applyTheme } from '../ui/appearance.js';
import { kb } from '../ui/letter-button.js';
import { K, LANG, t } from '../i18n/core.js';
import { fmt } from '../i18n/helpers.js';
import { $, $$, addDays, entriesOf, esc, must, todayISO, valuesOf } from '../util.js';

/* ---------- advanced student profile: identity, goals, levels, achievements, detailed stats ---------- */
/* shrink a photo to a 160 px square JPEG so it fits comfortably in localStorage */
/** @param {File} file @returns {Promise<string>} */
function photoToDataUrl(file) {
  return new Promise((res, rej) => {
    const img = new Image(),
      url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.naturalWidth, img.naturalHeight),
        c = document.createElement('canvas'),
        ctx = c.getContext('2d');
      c.width = c.height = 160;
      if (!ctx) {
        URL.revokeObjectURL(url);
        rej(new Error('no canvas'));
        return;
      }
      ctx.drawImage(
        img,
        (img.naturalWidth - s) / 2,
        (img.naturalHeight - s) / 2,
        s,
        s,
        0,
        0,
        160,
        160,
      );
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rej(new Error('bad image'));
    };
    img.src = url;
  });
}
/** @type {readonly import('../../types/app').Avatar['t'][]} */
const AVATAR_TYPES = ['initial', 'kana', 'photo'];
let pfMsg = '',
  pfDelArmed = false;
/** A chosen photo, as a data URL, waiting for Save. @type {string | null} */
let pendingPhoto = null;
export function renderProfile() {
  const p = me();
  if (!p) return;
  const g = goalOf(p),
    c = progressCtx(),
    xp = xpOf(c),
    lv = levelOf(xp),
    av = p.av;
  let h =
    '<div class="phero">' +
    avatar(p, 'xl') +
    '<div><h2 dir="auto">' +
    esc(p.name) +
    '</h2><p class="lvname">' +
    t('pf.level', { n: lv.n, name: levelName(lv.n) }) +
    '</p>';
  h +=
    '<div class="xpbar" role="img" aria-label="' +
    (lv.to ? t('pf.xp', { xp, left: lv.to - xp, next: lv.n + 1 }) : t('pf.xpMax', { xp })) +
    '"><i style="width:' +
    (lv.to ? Math.round(((xp - lv.from) / (lv.to - lv.from)) * 100) : 100) +
    '%"></i></div>';
  h +=
    '<p class="small muted">' +
    (lv.to ? t('pf.xp', { xp, left: lv.to - xp, next: lv.n + 1 }) : t('pf.xpMax', { xp })) +
    '</p></div></div>';
  h +=
    '<details class="more"><summary>' +
    t('pf.xpHowT') +
    '</summary><p class="small">' +
    t('pf.xpHow') +
    '</p></details>';
  /* today */
  const m = minutesToday();
  h +=
    '<h3>' +
    t('pf.today') +
    '</h3><div class="goalbar" role="img" aria-label="' +
    todayText() +
    '"><i style="width:' +
    Math.min(100, Math.round((m / g.min) * 100)) +
    '%"></i></div>';
  h +=
    '<p class="small"><span id="todayMin">' +
    todayText() +
    '</span>. ' +
    t('pf.streakNow', { n: streakOf(state.act) }) +
    '</p><p class="small muted">' +
    t('pf.todayNote') +
    '</p>';
  /* achievements */
  const earned = BADGES.filter((b) => state.badges[b.id]).length;
  h +=
    '<h3>' +
    t('pf.badges') +
    ' <span class="muted small">' +
    t('pf.badgesN', { n: earned, m: BADGES.length }) +
    '</span></h3><div class="badges">';
  h +=
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
    }).join('') + '</div>';
  /* detailed stats */
  h += '<h3>' + t('pf.stats') + '</h3>';
  const wk = weakest(8);
  h +=
    '<h4>' +
    t('pf.weak') +
    '</h4>' +
    (wk.length
      ? '<div class="missed">' +
        wk.map((k) => kb(k)).join('') +
        '</div><div class="btnrow"><button class="btn primary" id="pfDrillWeak">' +
        t('pf.drillThese') +
        '</button></div>'
      : '<p class="small muted">' + t('pf.weakNone') + '</p>');
  /** @type {[string, string[]][]} */
  const groups = [
    ...ROWS.map((r) => /** @type {[string, string[]]} */ ([kanaOf(r)[0], kanaOf(r)])),
    ...DROWS.map((r) => /** @type {[string, string[]]} */ ([r.kana[0], r.kana])),
    ['きゃ…', YOON33],
  ];
  h +=
    '<h4>' +
    t('pf.rows') +
    '</h4><div class="racc">' +
    groups
      .map(([lab, list]) => {
        const v = rowAcc(list);
        return (
          '<div class="rr"><span class="kana">' +
          lab +
          '</span><span class="rbar"><i style="width:' +
          (v || 0) +
          '%"></i></span><span class="small' +
          (v === null ? ' muted' : '') +
          '">' +
          (v === null ? t('pf.rowNone') : v + '%') +
          '</span></div>'
        );
      })
      .join('') +
    '</div>';
  const ts = valuesOf(state.stats)
    .map((s) => s.t)
    .filter((x) => x > 0);
  h +=
    '<h4>' +
    t('pf.speed') +
    '</h4><p class="small">' +
    (ts.length
      ? t('pf.speedV', { s: (ts.reduce((x, y) => x + y, 0) / ts.length / 1000).toFixed(1) })
      : t('none')) +
    '</p>';
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(todayISO(), i - 6)).map((d) => ({
    d,
    m: Math.floor((state.time[d] || 0) / 60),
  }));
  const top = Math.max(g.min, ...last7.map((x) => x.m));
  h +=
    '<h4>' +
    t('pf.minutes') +
    '</h4><div class="rounds mins" role="img" aria-label="' +
    t('pf.minutes') +
    ': ' +
    last7.map((x) => x.m).join(', ') +
    '"><span class="goal" style="bottom:' +
    Math.round((g.min / top) * 100) +
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
    '</div>';
  h +=
    '<div class="calx small muted"><span>' +
    fmt(last7[0].d) +
    '</span><span>' +
    fmt(last7[6].d) +
    '</span></div><p class="small muted">' +
    t('pf.minNote', { g: g.min }) +
    '</p>';
  const mix = entriesOf(state.mix)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 5);
  h +=
    '<h4>' +
    t('pf.mix') +
    '</h4>' +
    (mix.length
      ? '<ul class="mixl">' +
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
        '</ul>'
      : '<p class="small muted">' + t('pf.mixNone') + '</p>');
  /* appearance: applied at once and saved with the student */
  const th = cleanTheme(p.theme);
  /* [paper, surface, grid] for light, then for dark, so each preview matches the mode in use */
  /** @type {Record<import('../../types/app').Tint, string[]>} */
  const TC = {
    sage: ['#F5F7F3', '#FFFFFF', '#B7D2C8', '#15221D', '#1B2B25', '#3A5A4F'],
    sand: ['#F8F4EC', '#FFFFFF', '#D8CDB4', '#211C14', '#2A241A', '#5A4D36'],
    sky: ['#F1F6FA', '#FFFFFF', '#B4CADB', '#121D28', '#192733', '#3A5870'],
    rose: ['#FBF3F2', '#FFFFFF', '#E0BDB8', '#241A1B', '#2E2223', '#5E4040'],
    lilac: ['#F5F3FA', '#FFFFFF', '#C8C0DD', '#1B1826', '#241F32', '#4E4670'],
    slate: ['#F3F4F5', '#FFFFFF', '#BCC3C9', '#17191C', '#1F2226', '#474D55'],
    white: ['#FFFFFF', '#F6F7F5', '#C3D3CC', '#000000', '#111513', '#3A4A43'],
  };
  h +=
    '<h3>' +
    t('pf.look') +
    '</h3><div class="themebox"><span class="small muted">' +
    t('th.mode') +
    '</span><div class="seg" role="group" aria-label="' +
    t('th.mode') +
    '">' +
    MODES.map(
      (m) =>
        '<button type="button" data-mode="' +
        m +
        '" aria-pressed="' +
        (th.mode === m) +
        '">' +
        t(`th.${m}`) +
        '</button>',
    ).join('') +
    '</div>';
  h +=
    '<fieldset class="tints"><legend class="small muted">' +
    t('th.bg') +
    '</legend><div class="tintgrid">' +
    TINTS.map(
      (k) =>
        '<label class="tint"><input type="radio" name="pfTint" value="' +
        k +
        '"' +
        (th.tint === k ? ' checked' : '') +
        '><span class="tp" style="--c:' +
        TC[k][0] +
        ';--s:' +
        TC[k][1] +
        ';--g:' +
        TC[k][2] +
        ';--cd:' +
        TC[k][3] +
        ';--sd:' +
        TC[k][4] +
        ';--gd:' +
        TC[k][5] +
        '"></span><span>' +
        t(`th.${k}`) +
        '</span></label>',
    ).join('') +
    '</div></fieldset><p class="small muted">' +
    t('th.note') +
    '</p></div>';
  /* details and goals */
  h +=
    '<h3>' +
    t('pf.details') +
    '</h3><form id="pfForm" class="sform pform" novalidate autocomplete="off">';
  h +=
    '<label class="field"><span class="small muted">' +
    t('f.name') +
    '</span><input id="pfName" maxlength="24" dir="auto" value="' +
    esc(p.name) +
    '"></label>';
  h +=
    '<fieldset class="avpick"><legend class="small muted">' +
    t('f.avatar') +
    '</legend>' +
    AVATAR_TYPES.map(
        (x) =>
          '<label><input type="radio" name="pfAv" value="' +
          x +
          '"' +
          (av.t === x ? ' checked' : '') +
          '> ' +
          t(`av.${x}`) +
          '</label>',
      )
      .join('') +
    '</fieldset>';
  h +=
    '<div class="avopts"><label class="field avk"><span class="small muted">' +
    t('av.kana') +
    '</span><select id="pfKana">' +
    A46.map((k) => '<option' + (av.k === k ? ' selected' : '') + '>' + k + '</option>').join('') +
    '</select></label>';
  h +=
    '<div class="field avp"><button class="btn" type="button" id="pfPhotoBtn">' +
    t('av.upload') +
    '</button><input type="file" id="pfPhoto" accept="image/*" hidden><span class="small muted">' +
    t('av.note') +
    '</span></div></div>';
  h += swatches('pfColor', p.color);
  h +=
    '<div class="fgrid">' +
    sel('pfAge', ageOpts(), p.age || 'adult', t('f.age')) +
    sel('pfNative', nativeOpts(), p.native || LANG, t('f.native')) +
    sel('pfJl', jlOpts(), p.jlevel || 'new', t('f.jlevel')) +
    sel('pfLang', languageOpts(), p.lang || LANG, t('f.uiLang')) +
    sel('pfRate', rateOpts(), p.rate, t('f.rate')) +
    sel('pfReason', reasonOpts(), g.reason, t('f.reason'), goalHint(g.reason)) +
    sel('pfPace', paceOpts(), g.pace, t('f.pace')) +
    sel('pfMin', minOpts(), g.min, t('f.min')) +
    '</div>';
  h +=
    '<p class="small muted">' +
    t('pace.change') +
    '</p><p class="fmsg" id="pfMsg" role="alert">' +
    esc(pfMsg) +
    '</p>';
  h +=
    '<div class="btnrow"><button class="btn primary" type="submit">' +
    t('pf.save') +
    '</button></div></form>';
  /* data */
  h += '<h3>' + t('pf.data') + '</h3><p class="small muted">' + syncText() + '</p>';
  h +=
    '<div class="btnrow"><button class="btn" id="pExport">' +
    t('p.export') +
    '</button><button class="btn primary" id="pSwitch">' +
    t('p.switch') +
    '</button></div>';
  h +=
    '<div class="btnrow"><button class="btn red" id="pDelete">' +
    (pfDelArmed ? t('p.deleteConfirm', { name: esc(p.name) }) : t('p.delete')) +
    '</button></div>';
  const root = must('#tab-profile');
  root.innerHTML = h;
  pfMsg = '';
  /** @param {Partial<import('../../types/app').Theme>} patch */
  const setTheme = (patch) => {
    updateStudent(p.id, { theme: { ...cleanTheme(p.theme), ...patch } });
    applyTheme(p.theme, true);
  };
  $$('[data-mode]', root).forEach(
    (b) =>
      (b.onclick = () => {
        const mode = MODES.find((m) => m === b.dataset.mode);
        if (mode) setTheme({ mode });
        $$('[data-mode]', root).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      }),
  );
  $$('input[name="pfTint"]', root, HTMLInputElement).forEach(
    (r) =>
      (r.onchange = () => {
        const tint = TINTS.find((k) => k === r.value);
        if (tint) setTheme({ tint });
      }),
  );
  /** The value of a radio group, if one is chosen. @param {string} name */
  const checked = (name) => $(`input[name="${name}"]:checked`, root, HTMLInputElement)?.value;
  const syncAv = () => {
    const v = checked('pfAv');
    must('.avk', root).hidden = v !== 'kana';
    must('.avp', root).hidden = v !== 'photo';
  };
  $$('input[name="pfAv"]', root, HTMLInputElement).forEach((r) => (r.onchange = syncAv));
  syncAv();
  const photoInput = must('#pfPhoto', root, HTMLInputElement);
  must('#pfPhotoBtn', root).onclick = () => photoInput.click();
  photoInput.onchange = async () => {
    const f = photoInput.files && photoInput.files[0];
    if (!f) return;
    try {
      pendingPhoto = await photoToDataUrl(f);
      must('#pfPhotoBtn', root).textContent = t('av.ready');
    } catch (err) {
      must('#pfMsg', root).textContent = t('av.bad');
    }
  };
  /** @param {string} id */
  const selectValue = (id) => must('#' + id, root, HTMLSelectElement).value;
  must('#pfForm', root).onsubmit = (e) => {
    e.preventDefault();
    const name = cleanName(must('#pfName', root, HTMLInputElement).value),
      msg = must('#pfMsg', root);
    if (!name) {
      msg.textContent = t('err.noName');
      return;
    }
    if (nameTaken(name, p.id)) {
      msg.textContent = t('err.taken2', { name });
      return;
    }
    const avT = checked('pfAv') || 'initial';
    if (avT === 'photo' && !pendingPhoto && !p.av.img) {
      msg.textContent = t('av.need');
      return;
    }
    updateStudent(p.id, {
      name,
      color: checked('pfColor') || p.color,
      av: {
        t: avT,
        k: selectValue('pfKana'),
        img: avT === 'photo' ? pendingPhoto || p.av.img : '',
      },
      age: selectValue('pfAge'),
      native: selectValue('pfNative'),
      jlevel: selectValue('pfJl'),
      rate: Number(selectValue('pfRate')) === 0.75 ? 0.75 : 1,
      goal: {
        pace: Number(selectValue('pfPace')),
        min: Number(selectValue('pfMin')),
        reason: selectValue('pfReason'),
      },
      lang: selectValue('pfLang'),
    });
    pendingPhoto = null;
    setLang(p.lang);
    applyStudent();
    renderWho();
    renderAll();
    pfMsg = t('pf.saved');
    renderProfile();
    const m2 = $('#pfMsg');
    if (m2) {
      m2.classList.add('ok');
      m2.scrollIntoView({ block: 'center' });
    }
  };
  const dw = $('#pfDrillWeak', root);
  if (dw)
    dw.onclick = () => {
      ui.drillMode = 'read';
      ui.session = null;
      startDrill(wk);
      showTab('drill');
    };
  must('#pExport', root).onclick = exportStudent;
  must('#pSwitch', root).onclick = () => {
    pfDelArmed = false;
    switchStudent();
  };
  must('#pDelete', root).onclick = () => {
    if (!pfDelArmed) {
      pfDelArmed = true;
      renderProfile();
      setTimeout(() => {
        if (pfDelArmed) {
          pfDelArmed = false;
          if (ui.currentTab === 'profile') renderProfile();
        }
      }, 5000);
      return;
    }
    pfDelArmed = false;
    removeStudent(p.id);
    ui.loginMsg = '';
    showLogin();
  };
}
function exportStudent() {
  const p = me();
  if (!p) return;
  const data = {
    app: 'hiragana14',
    kind: 'student',
    v: 1,
    exported: new Date().toISOString(),
    student: {
      name: p.name,
      color: p.color,
      created: p.created,
      lang: p.lang || LANG,
      age: p.age,
      native: p.native,
      jlevel: p.jlevel,
      rate: p.rate,
      goal: p.goal,
      av: p.av,
      theme: p.theme,
    },
    progress: state,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  const slug =
    p.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'student';
  const a = document.createElement('a');
  a.href = url;
  a.download = 'hiragana-' + slug + '-' + todayISO() + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
