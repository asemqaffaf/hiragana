/* The app should feel like an installed app, and installed apps do not zoom when two fingers move apart. On a phone the page
   stays at its natural size: no pinch zoom, no double-tap zoom, no zoom when a text field is focused.
   Three layers, because no single one covers every browser:
   - index.html: `maximum-scale=1, user-scalable=no` (Android Chrome and most browsers obey it);
   - base.css: `touch-action: pan-x pan-y` on touch screens, which removes pinch and double-tap zoom in iOS 13+ and Chrome;
   - this file: iPhone Safari still fires its own `gesture*` events for a pinch, and older versions ignore the two layers above.
   Desktop is untouched (the browser's own zoom keys and the trackpad still work); only touch input is affected. */
const touch = matchMedia('(pointer: coarse)');

/** @param {Event} e */
const block = (e) => {
  if (touch.matches && e.cancelable) e.preventDefault();
};
document.addEventListener('gesturestart', block, { passive: false });
document.addEventListener('gesturechange', block, { passive: false });
document.addEventListener('gestureend', block, { passive: false });
/* a second finger on the screen starts a pinch: swallow its moves (one-finger scrolling and drawing are not touched) */
document.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches.length > 1) block(e);
  },
  { passive: false },
);
