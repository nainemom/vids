import { useEffect } from 'react';
import { Router, Switch, Route, Redirect } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import {
  doesFocusableExist,
  getCurrentFocusKey,
  setFocus,
} from '@noriginmedia/norigin-spatial-navigation';
import { Sidebar } from './components/Sidebar';
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
// focused component — on first paint before the initial focus lands, or when the
// focused element unmounts and its parent can't auto-restore (e.g. a card whose
// whole row was removed). `setFocus()` with no key resolves to the `forceFocus`
// container (the current page's body — see Page.tsx), drilling down to a real
// leaf. We re-assert it immediately and then poll as a cheap safety net, but
// only when focus is truly gone — a valid focus (a card, a nav item, a dialog
// field) is left untouched, so this never steals focus from the sidebar, header,
// or an open dialog.
function useFocusGuard() {
  useEffect(() => {
    const ensureFocus = () => {
      const key = getCurrentFocusKey();
      // An empty key routes to the forceFocus container (the page body).
      if (!key || !doesFocusableExist(key)) setFocus('');
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

  return (
    <div
      className={[
        'flex h-screen overflow-hidden bg-neutral-950 text-white',
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
