import { useEffect, useState } from 'react';
import { Router, Switch, Route, Redirect, useLocation } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import {
  FocusContext,
  doesFocusableExist,
  getCurrentFocusKey,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Home } from './pages/Home';
import { Search } from './pages/Search';
import { Sources } from './pages/Sources';
import { Settings } from './pages/Settings';

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
// container (the content), drilling down to a real leaf. We re-assert it
// immediately and then poll as a cheap safety net, but only when focus is truly
// gone — a valid focus (a card, a nav item, a dialog field) is left untouched,
// so this never steals focus from the sidebar, header, or an open dialog.
function useFocusGuard() {
  useEffect(() => {
    const ensureFocus = () => {
      const key = getCurrentFocusKey();
      // An empty key routes to the forceFocus container (see Content).
      if (!key || !doesFocusableExist(key)) setFocus('');
    };
    ensureFocus();
    const id = window.setInterval(ensureFocus, 250);
    return () => window.clearInterval(id);
  }, []);
}

function Shell() {
  const [highlighted, setHighlighted] = useState<string | undefined>(undefined);
  const [location] = useLocation();

  // Sidebar, Header and the content area are three sibling focus groups under
  // the implicit root, so the engine navigates between them by geometry:
  // ← into the sidebar, ↑ into the header, and back into the content. The guard
  // lands the initial focus on the content and keeps a highlight alive after.
  useFocusGuard();

  // The header title is driven by the highlighted card on Home; clear it when
  // navigating away so other pages fall back to "Vids" instead of showing a
  // stale card title.
  useEffect(() => {
    setHighlighted(undefined);
  }, [location]);

  return (
    <div
      className={[
        'flex h-screen overflow-hidden bg-neutral-950 text-white',
      ].join(' ')}
    >
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={highlighted} />
        <Content onHighlight={setHighlighted} />
      </div>
    </div>
  );
}

type ContentProps = {
  onHighlight: (label: string) => void;
};

// Its own focus group so the pages bubble up to it (card -> row -> content), and
// `saveLastFocusedChild` restores the last item when focus returns from the
// sidebar/header. `focusKey: 'content'` lets Shell set the initial focus here.
// The routed page renders inside this stable group, so the sidebar/header can
// always navigate back into "content" regardless of which page is shown.
//
// `forceFocus` makes this the engine's fallback target: whenever focus is lost
// (an arrow pressed with nothing focused, a recovery via `setFocus()`), the
// engine force-focuses the nearest forceFocus container — here, the content —
// so navigation can never dead-end with nothing highlighted. See useFocusGuard.
function Content({ onHighlight }: ContentProps) {
  const { ref, focusKey } = useFocusable({
    focusKey: 'content',
    saveLastFocusedChild: true,
    forceFocus: true,
  });

  // Only left padding — the right side runs to the container edge so Home rows
  // use the full width (see CardRow); page bodies cap their own width.
  return (
    <FocusContext.Provider value={focusKey}>
      <main
        ref={ref}
        className="no-scrollbar flex-1 overflow-y-auto pb-12 px-4"
      >
        <Switch>
          <Route path="/">
            <Home onHighlight={onHighlight} />
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
      </main>
    </FocusContext.Provider>
  );
}
