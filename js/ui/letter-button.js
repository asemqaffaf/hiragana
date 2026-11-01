import { st } from '../core/stats.js';
import { isComplete } from '../core/progress.js';
import { rom } from '../data/letters.js';
import { t } from '../i18n/core.js';

export function kb(k, cls, bar) {
  return (
    '<button class="kb' +
    (cls || '') +
    (isComplete(k) ? ' cl' : '') +
    '" data-open="' +
    k +
    '" aria-label="' +
    k +
    ', ' +
    rom(k) +
    (isComplete(k) ? ', ' + t('cl.done') : '') +
    '"><span class="sq"><span class="k">' +
    k +
    '</span></span><span class="r">' +
    rom(k) +
    '</span>' +
    (bar ? '<span class="m" style="--m:' + (st(k).b || 0) / 5 + '"></span>' : '') +
    '</button>'
  );
}
