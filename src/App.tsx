import { useEffect, useRef } from 'react';
import { Router, Switch, Route, Redirect, useLocation } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import {
  doesFocusableExist,
  getCurrentFocusKey,
  setFocus,
} from '@noriginmedia/norigin-spatial-navigation';
import { Sidebar, SIDEBAR_KEY } from './components/Sidebar';
import { PAGE_BODY_KEY } from './components/Page';
import { handleBack } from './backstack';
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

// Where "Back" goes from a given route — mirrors each page's own Back button so
// the remote's Back key (and Escape/Backspace) behaves identically everywhere:
//   group (season) -> its series, series/movie/other top-level page -> Home,
//   Home -> nowhere (null). Pure so it's trivial to reason about.
function parentRoute(location: string): string | null {
  const group = location.match(/^\/series\/([^/]+)\/[^/]+$/);
  if (group) return `/series/${group[1]}`;
  return location === '/' ? null : '/';
}

// Whether the event targets a text field, so editing keys (Backspace, Home)
// keep their normal meaning there instead of triggering navigation.
function isEditableTarget(e: KeyboardEvent): boolean {
  const el = (e.target as HTMLElement | null) ?? (document.activeElement as HTMLElement | null);
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

/**
 * Global handling for the remote's Back and Home buttons (and their keyboard
 * equivalents) — the arrow keys and OK/Play are handled by the spatial-nav
 * engine (see spatial.ts), but Back/Home aren't keys it knows about. We listen
 * in the capture phase, across every page, and cover the various codes different
 * remotes/TVs emit. Back first dismisses an open dialog (via the back stack),
 * then walks up the route; Home jumps straight to the library root.
 */
function useRemoteKeys() {
  const [location, navigate] = useLocation();
  // The listener binds once; read the live location through a ref so it always
  // walks up from the page actually showing.
  const locationRef = useRef(location);
  locationRef.current = location;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const editable = isEditableTarget(e);

      // Back: Esc / Backspace / the remote's Back button. Backspace is left to
      // the field while typing. keyCodes cover webOS (461) and Tizen (10009).
      const isBack =
        e.key === 'Escape' ||
        e.key === 'BrowserBack' ||
        e.key === 'GoBack' ||
        e.keyCode === 27 ||
        e.keyCode === 166 ||
        e.keyCode === 461 ||
        e.keyCode === 10009 ||
        (!editable && (e.key === 'Backspace' || e.keyCode === 8));

      if (isBack) {
        // An open dialog gets dismissed before we touch the route.
        if (handleBack()) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        const parent = parentRoute(locationRef.current);
        if (parent !== null) {
          e.preventDefault();
          e.stopPropagation();
          navigate(parent);
        }
        return;
      }

      // Home: the remote's Home button. The plain Home key keeps its
      // start-of-field meaning while typing.
      const isHome =
        e.key === 'BrowserHome' ||
        e.key === 'GoHome' ||
        e.keyCode === 172 ||
        (!editable && (e.key === 'Home' || e.keyCode === 36));

      if (isHome) {
        e.preventDefault();
        e.stopPropagation();
        navigate('/'); // any open dialog unmounts with its page
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [navigate]);
}

function Shell() {
  // Three focus regions navigated by geometry: the Sidebar on the left, and —
  // within each page (see Page.tsx) — the Header bar (↑) above the scrolling
  // body. The guard keeps a highlight alive across navigation.
  useFocusGuard();
  // Remote Back / Home buttons (and keyboard Esc/Backspace/Home).
  useRemoteKeys();
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
