import { init, setKeyMap } from '@noriginmedia/norigin-spatial-navigation';

// Initialize the spatial-navigation engine once for the whole app.
// This binds the arrow keys (and Enter) globally — no manual keydown
// listeners needed anywhere. Flip `debug`/`visualDebug` on while developing
// to see focusable boundaries and navigation decisions in the console.
init({
  debug: false,
  visualDebug: false,
});

// Treat the remote's Play / Pause buttons as "OK" so they activate the focused
// item (play a video, open a card) — there's nothing else playing in the browse
// UI to pause. The engine matches against `event.keyCode || event.code`, so we
// list both the numeric media-key code and the DOM `code` strings; the defaults
// (13 / 'Enter') are restored alongside since setKeyMap replaces a key's list.
// Back / Home are handled separately (see useRemoteKeys in App.tsx).
setKeyMap({
  enter: [13, 'Enter', 179, 'MediaPlayPause', 'MediaPlay', 'MediaPause'],
});

// Focus is driven entirely by the arrow keys (via the engine above). The
// browser's native Tab traversal moves DOM focus on its own, which would
// desync the visible focus ring from where the engine thinks focus is — so
// swallow Tab / Shift+Tab everywhere. Capture phase runs before the browser
// acts on the key.
window.addEventListener(
  'keydown',
  (e) => {
    if (e.key === 'Tab') e.preventDefault();
  },
  true,
);
