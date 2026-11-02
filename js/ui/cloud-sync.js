import { cloudStatus, pendingCloudDeletes, subscribeCloud, syncOn } from '../core/cloud.js';
import { t } from '../i18n/core.js';
import { esc } from '../util.js';

/** @param {string} id */
function statusText(id) {
  const status = cloudStatus(id);
  if (status.state !== 'error') return t(`cloud.${status.state}`);
  /** @type {Record<string, import('../../types/app').TextKey>} */
  const errors = {
    deployment: 'cloud.error.deployment', network: 'cloud.error.network', 'not yours': 'cloud.error.credentials',
    'not found': 'cloud.error.missing', deleted: 'cloud.error.missing', conflict: 'cloud.error.conflict', changed: 'cloud.error.changed',
    'too large': 'cloud.error.large', 'local storage': 'cloud.error.storage',
  };
  return t(errors[status.error || ''] || 'cloud.error.failed');
}
/** @param {string} id */
export function cloudPanel(id) {
  if (!syncOn) return '';
  return '<div class="cloudbox"><p class="small" role="status" aria-live="polite" data-cloud-status="' + esc(id) + '">' +
    esc(statusText(id)) + '</p><div class="btnrow"><button class="btn" type="button" id="cloudSave">' +
    t('cloud.save') + '</button><button class="btn" type="button" id="cloudRestore">' +
    t('cloud.restore') + '</button></div><p class="small muted">' + t('cloud.restoreHint') + '</p></div>';
}
export function cloudDeleteNote() {
  if (!syncOn) return '';
  return '<p class="small note" role="status" data-cloud-deletes' + (pendingCloudDeletes() ? '' : ' hidden') + '>' +
    t('cloud.deletes') + '</p>';
}
/** @param {string | null} id */
export function renderCloudSummary(id) {
  const element = document.getElementById('cloudSummary');
  if (!element) return;
  element.hidden = !syncOn || !id;
  if (id) {
    element.setAttribute('data-cloud-status', id);
    element.textContent = statusText(id);
  } else element.removeAttribute('data-cloud-status');
}
subscribeCloud(() => {
  for (const element of document.querySelectorAll('[data-cloud-status]')) {
    element.textContent = statusText(element.getAttribute('data-cloud-status') || '');
  }
  for (const element of document.querySelectorAll('[data-cloud-deletes]')) {
    if (element instanceof HTMLElement) element.hidden = pendingCloudDeletes() === 0;
  }
});
