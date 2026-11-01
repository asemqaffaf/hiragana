import {reduceAnim, replay} from '../core/motion.js';
import {showTab} from '../core/nav.js';
import {ui} from '../core/ui-state.js';
import {closeSheet} from './sheet.js';

(function () {
  const hb = document.getElementById('homeBtn'); if (!hb) return;
  const go = () => {
    if (document.body.classList.contains('signed-out')) return;
    closeSheet('silent');
    if (ui.currentTab === 'plan') window.scrollTo({top: 0, behavior: reduceAnim() ? 'auto' : 'smooth'});
    else { ui.navStack = []; showTab('plan', {root: true}); }
    replay(hb, 'bounce'); setTimeout(() => hb.classList.remove('bounce'), 600);
  };
  hb.addEventListener('click', go);
  hb.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
})();
