import { ui } from '../core/ui-state.js';
import { DROWS, ROWS, YROWS } from '../data/letters.js';
import { kb } from '../ui/letter-button.js';
import { moveThumb } from '../ui/thumb.js';
import { t } from '../i18n/core.js';
import { $, $$, must } from '../util.js';

/** @type {readonly [import('../../types/app').ChartView, import('../../types/app').TextKey][]} */
const VIEWS = [
  ['basic', 'chart.basic'],
  ['dak', 'chart.dak'],
  ['yoon', 'chart.yoon'],
];

/** @param {string | null} k */
function cell(k) {
  if (!k) return '<div class="blank"></div>';
  return kb(k, ' cell', true);
}

/** @param {import('../../types/app').ChartView} view */
function renderPanel(view) {
  let h = '';
  if (view === 'yoon') {
    h +=
      '<div class="chart y3">' +
      ['ya', 'yu', 'yo'].map((x) => '<div class="hd">' + x + '</div>').join('') +
      YROWS.map((r) => r.kana.map(cell).join('')).join('') +
      '</div>';
    h += '<p class="note">' + t('chart.yoonNote') + '</p>';
  } else {
    const rows = view === 'basic' ? ROWS : DROWS;
    h +=
      '<div class="chart">' +
      ['a', 'i', 'u', 'e', 'o'].map((x) => '<div class="hd">' + x + '</div>').join('') +
      rows.map((r) => r.kana.map(cell).join('')).join('') +
      '</div>';
    if (view === 'dak') h += '<p class="note">' + t('chart.dakNote') + '</p>';
  }
  return h;
}

export function renderChart() {
  let h = '<h2>' + t('tab.chart') + '</h2><p class="muted">' + t('chart.intro') + '</p>';
  h +=
    '<div class="seg chartseg" role="tablist" aria-label="' +
    t('chart.which') +
    '" data-thumb-key="chart">' +
    VIEWS.map(
      ([id, l]) =>
        '<button type="button" role="tab" data-view="' +
        id +
        '" id="chartTab-' +
        id +
        '" aria-selected="' +
        (ui.chartView === id) +
        '" aria-pressed="' +
        (ui.chartView === id) +
        '" aria-controls="chartBody">' +
        t(l) +
        '</button>',
    ).join('') +
    '</div>';
  h += '<div id="chartBody" role="region" aria-live="polite">' + renderPanel(ui.chartView) + '</div>';

  const root = must('#tab-chart');
  const same = root.dataset.rendered === '1';
  root.innerHTML = h;
  root.dataset.rendered = '1';

  const seg = $('.chartseg', root);
  const body = $('#chartBody', root);
  moveThumb(seg, 'chart', !same);

  $$('[data-view]', root).forEach((b) => {
    b.onclick = () => {
      const view = VIEWS.find(([id]) => id === b.dataset.view);
      if (!view || view[0] === ui.chartView) return;
      ui.chartView = view[0];
      $$('[data-view]', root).forEach((x) => {
        const on = x === b;
        x.setAttribute('aria-selected', String(on));
        x.setAttribute('aria-pressed', String(on));
      });
      if (body) body.innerHTML = renderPanel(ui.chartView);
      moveThumb(seg, 'chart');
    };
  });
}
