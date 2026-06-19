import { init } from '@noriginmedia/norigin-spatial-navigation';

// Initialize the spatial-navigation engine once for the whole app.
// This binds the arrow keys (and Enter) globally — no manual keydown
// listeners needed anywhere. Flip `debug`/`visualDebug` on while developing
// to see focusable boundaries and navigation decisions in the console.
init({
  debug: false,
  visualDebug: false,
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
