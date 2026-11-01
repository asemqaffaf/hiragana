import { ui } from '../core/ui-state.js';
import { DROWS, ROWS, YROWS } from '../data/letters.js';
import { kb } from '../ui/letter-button.js';
import { t } from '../i18n/core.js';
import { $$, must } from '../util.js';

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
export function renderChart() {
  let h = '<h2>' + t('tab.chart') + '</h2><p class="muted">' + t('chart.intro') + '</p>';
  h +=
    '<div class="seg" role="group" aria-label="' +
    t('chart.which') +
    '">' +
    VIEWS.map(
        ([id, l]) =>
          '<button data-view="' +
          id +
          '" aria-pressed="' +
          (ui.chartView === id) +
          '">' +
          t(l) +
          '</button>',
      )
      .join('') +
    '</div>';
  if (ui.chartView === 'yoon') {
    h +=
      '<div class="chart y3">' +
      ['ya', 'yu', 'yo'].map((x) => '<div class="hd">' + x + '</div>').join('') +
      YROWS.map((r) => r.kana.map(cell).join('')).join('') +
      '</div>';
  } else {
    const rows = ui.chartView === 'basic' ? ROWS : DROWS;
    h +=
      '<div class="chart">' +
      ['a', 'i', 'u', 'e', 'o'].map((x) => '<div class="hd">' + x + '</div>').join('') +
      rows.map((r) => r.kana.map(cell).join('')).join('') +
      '</div>';
  }
  if (ui.chartView === 'dak') h += '<p class="note">' + t('chart.dakNote') + '</p>';
  if (ui.chartView === 'yoon') h += '<p class="note">' + t('chart.yoonNote') + '</p>';
  const root = must('#tab-chart');
  root.innerHTML = h;
  $$('[data-view]', root).forEach(
    (b) =>
      (b.onclick = () => {
        const view = VIEWS.find(([id]) => id === b.dataset.view);
        if (view) ui.chartView = view[0];
        renderChart();
      }),
  );
}
