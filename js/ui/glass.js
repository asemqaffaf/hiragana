import { reduceAnim } from '../core/motion.js';

/* Liquid Glass reflection: the broad glare on the tab bar (css/ios.css, nav.tabs::before) slides sideways a little as the page
   scrolls, so the glass seems to catch light from something moving. Only a CSS variable on the one bar changes, once per
   frame, so it costs next to nothing; it stops for people who asked for reduced motion. */
const bar = document.querySelector('nav.tabs');
let queued = false;
function update() {
  queued = false;
  if (!(bar instanceof HTMLElement)) return;
  bar.style.setProperty('--sx', reduceAnim() ? '0' : (Math.sin(scrollY / 260) * 34 - 20).toFixed(1));
}
addEventListener(
  'scroll',
  () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  },
  { passive: true },
);
update();
