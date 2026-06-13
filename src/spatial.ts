import { init } from '@noriginmedia/norigin-spatial-navigation';

// Initialize the spatial-navigation engine once for the whole app.
// This binds the arrow keys (and Enter) globally — no manual keydown
// listeners needed anywhere. Flip `debug`/`visualDebug` on while developing
// to see focusable boundaries and navigation decisions in the console.
init({
  debug: false,
  visualDebug: false,
});
