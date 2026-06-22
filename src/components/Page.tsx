import { useEffect, type ReactNode } from 'react';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';

// Only one Page is mounted at a time (routes are exclusive), so a constant focus
// key is safe. Exported so the focus guard (App.tsx) can recognise when focus is
// stuck on the (invisible) body container itself — which happens when the body
// had no focusable children at mount and they only appear once the library loads.
export const PAGE_BODY_KEY = 'page-body';

type PageProps = {
  /** The page's top bar — pass a <Header .../>. Stays put while the body scrolls. */
  header?: ReactNode;
  children: ReactNode;
};

/**
 * Standard page layout: a fixed header on top and a scrolling body beneath it.
 * The body is the page's main focus group — it auto-focuses its first item when
 * the page opens (↑ from there reaches the header), restores the last focused
 * item when focus returns from the sidebar/header (`saveLastFocusedChild`), and
 * is the engine's fallback target when focus is otherwise lost (`forceFocus` —
 * see useFocusGuard in App.tsx). Because the header lives outside this scroll
 * container, it never scrolls away.
 */
export function Page({ header, children }: PageProps) {
  const { ref, focusKey } = useFocusable({
    focusKey: PAGE_BODY_KEY,
    saveLastFocusedChild: true,
    forceFocus: true,
  });

  useEffect(() => {
    setFocus(PAGE_BODY_KEY);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header}
      <FocusContext.Provider value={focusKey}>
        <main
          ref={ref}
          className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-6 pt-0"
        >
          {children}
        </main>
      </FocusContext.Provider>
    </div>
  );
}
