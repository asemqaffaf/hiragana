import {ui} from './ui-state.js';
import {renderChart} from '../features/chart.js';
import {renderDrill} from '../features/drill.js';
import {renderPlan} from '../features/plan.js';
import {renderProfile} from '../features/profile.js';
import {renderProgress} from '../features/progress.js';
import {renderRead} from '../features/read.js';
import {renderWrite} from '../features/write.js';

export function renderAll() {
  renderPlan(); renderChart(); renderRead();
  if (ui.currentTab === 'progress') renderProgress();
  if (ui.currentTab === 'profile') renderProfile();
  if (ui.currentTab === 'drill' && !ui.session) renderDrill();
  if (ui.currentTab === 'write') renderWrite();
}
