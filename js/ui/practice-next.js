import { continuePractice } from '../core/nav.js';
import { nextPracticeStep } from '../core/practice.js';
import { ui } from '../core/ui-state.js';
import { t } from '../i18n/core.js';
import { $, must } from '../util.js';

/** Adds one optional next step without recording lesson completion. @param {HTMLElement} root @param {import('../../types/app').TabName} current */
export function bindPracticeNext(root, current) {
  const next = nextPracticeStep(current);
  if (!next || (current === 'write' && ui.lessonWrite)) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn primary practice-next';
  button.dataset.practiceNext = next;
  button.textContent = t('practice.next', { step: t(`tab.${next}`) });
  button.onclick = continuePractice;
  if (current === 'write') {
    must('.practice-continue-slot', root).appendChild(button);
  } else {
    const title = $(':scope > h2', root);
    if (!title) return;
    const heading = document.createElement('div');
    heading.className = 'practice-heading';
    title.before(heading);
    heading.append(title, button);
  }
}
