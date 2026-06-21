import { useEffect } from 'react';
import { Router, Switch, Route, Redirect } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import {
  doesFocusableExist,
  getCurrentFocusKey,
  setFocus,
} from '@noriginmedia/norigin-spatial-navigation';
import { Sidebar, SIDEBAR_KEY } from './components/Sidebar';
import { PAGE_BODY_KEY } from './components/Page';
import { useFullscreen } from './useFullscreen';
import { Home } from './pages/Home';
import { Search } from './pages/Search';
import { Sources } from './pages/Sources';
import { Settings } from './pages/Settings';
import { SeriesDetail } from './pages/SeriesDetail';
import { GroupDetail } from './pages/GroupDetail';
import { MovieDetail } from './pages/MovieDetail';

// Hash routing (#/sources, #/settings, …) rather than history routing: the
// production build is loaded from disk via `file://` (electron/main.ts ->
// win.loadFile), where path-based history navigation doesn't work. Hashes work
// in both the dev server and the packaged app.
export function App() {
  return (
    <Router hook={useHashLocation}>
      <Shell />
    </Router>
  );
}

// Guarantees something is always highlighted. The engine can end up with no
// *visible* focus in a few ways: on first paint before the initial focus lands;
// when the focused element unmounts and its parent can't auto-restore (e.g. a
// card whose whole row was removed); or — the common one at startup — when the
// page body has no focusable children yet (the library scan is async, so Home is
// empty on first paint), leaving focus parked on the invisible body container
// itself. `setFocus('')` resolves to the `forceFocus` container (the current
// page's body — see Page.tsx), drilling down to a real leaf when one exists. If
// the body still has nothing focusable, we fall back to the sidebar — the one
// group that's always mounted with focusable items — so a highlight is always
// shown. A valid focus (a card, a nav item, a dialog field) is left untouched,
// so this never steals focus from the sidebar, header, or an open dialog.
function useFocusGuard() {
  useEffect(() => {
    const ensureFocus = () => {
      const key = getCurrentFocusKey();
      // Focus on the body container itself is not a real, visible focus — treat
      // it like "no focus" so we keep trying to drill into the body's children
      // (which appear once the library finishes loading).
      const hasVisibleFocus =
        key && key !== PAGE_BODY_KEY && doesFocusableExist(key);
      if (hasVisibleFocus) return;

      setFocus(''); // forceFocus container (page body) -> first focusable leaf
      const next = getCurrentFocusKey();
      // Nothing focusable in the body yet — land on the nav so something shows.
      if (!next || next === PAGE_BODY_KEY) setFocus(SIDEBAR_KEY);
    };
    ensureFocus();
    const id = window.setInterval(ensureFocus, 250);
    return () => window.clearInterval(id);
  }, []);
}

function Shell() {
  // Three focus regions navigated by geometry: the Sidebar on the left, and —
  // within each page (see Page.tsx) — the Header bar (↑) above the scrolling
  // body. The guard keeps a highlight alive across navigation.
  useFocusGuard();
  // Rounded corners when windowed; squared off in fullscreen (where rounding
  // would just expose desktop slivers at the screen corners). The Electron
  // window is transparent, so the corners reveal the desktop behind the app.
  const isFullscreen = useFullscreen();

  return (
    <div
      className={[
        'flex h-screen overflow-hidden bg-neutral-950 text-white',
        isFullscreen ? '' : 'rounded-2xl',
      ].join(' ')}
    >
      <Sidebar />

      {/* Each routed page renders its own Header + scrolling body via Page. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Switch>
          <Route path="/">
            <Home />
          </Route>
          <Route path="/series/:id/:groupIndex">
            <GroupDetail />
          </Route>
          <Route path="/series/:id">
            <SeriesDetail />
          </Route>
          <Route path="/movie/:id">
            <MovieDetail />
          </Route>
          <Route path="/search">
            <Search />
          </Route>
          <Route path="/sources">
            <Sources />
          </Route>
          <Route path="/settings">
            <Settings />
          </Route>
          <Route>
            <Redirect to="/" />
          </Route>
        </Switch>
      </div>
    </div>
  );
}
