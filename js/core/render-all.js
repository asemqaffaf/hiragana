import { ui } from './ui-state.js';
import { renderPage } from './pages.js';

export function renderAll() {
  renderPage('plan');
  if (ui.currentTab === 'days') renderPage('days');
  renderPage('chart');
  renderPage('read');
  if (ui.currentTab === 'progress') renderPage('progress');
  if (ui.currentTab === 'profile') renderPage('profile');
  if (ui.currentTab === 'drill' && !ui.session) renderPage('drill');
  if (ui.currentTab === 'write') renderPage('write');
}
