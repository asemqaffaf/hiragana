/* Browser features that TypeScript's DOM library does not describe. */
interface Navigator {
  /** iOS 16.4+: lets sound play with the ring/silent switch on. */
  audioSession?: { type: string };
}
interface Window {
  webkitAudioContext?: typeof AudioContext;
  /** Test hooks, present only on `#test` pages. */
  __hira?: Record<string, unknown>;
  __hiraSnap?: boolean;
}
interface HTMLMediaElement {
  webkitPreservesPitch?: boolean;
}
