import { useEffect, useState } from 'react';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { CardRow } from './components/CardRow';
import { FocusableCard } from './components/FocusableCard';
import { Header } from './components/Header';
import { Sidebar, type NavKey } from './components/Sidebar';
import { useFullscreen } from './useFullscreen';

// Each row has enough cards to overflow horizontally, and there are enough rows
// to overflow vertically — so you can see both the container and the page scroll.
const makeItems = (prefix: string) =>
  Array.from({ length: 10 }, (_, i) => `${prefix} ${i + 1}`);

const ROWS = [
  { title: 'Continue Watching', items: makeItems('Recent') },
  { title: 'Trending', items: makeItems('Trending') },
  { title: 'New Releases', items: makeItems('New') },
  { title: 'My List', items: makeItems('Saved') },
  { title: 'Documentaries', items: makeItems('Doc') },
  { title: 'Because You Watched', items: makeItems('Pick') },
];

export function App() {
  const [activeNav, setActiveNav] = useState<NavKey>('home');
  const [highlighted, setHighlighted] = useState<string | undefined>(undefined);
  const isFullscreen = useFullscreen();

  // Sidebar, Header and the content area are three sibling focus groups under
  // the implicit root, so the engine navigates between them by geometry:
  // ← into the sidebar, ↑ into the header, and back into the content.
  useEffect(() => {
    setFocus('content');
  }, []);

  return (
    <div
      className={[
        'flex h-screen overflow-hidden bg-neutral-950 text-white',
        // No rounded corners in fullscreen — they'd leave transparent gaps
        // at the screen edges.
        isFullscreen ? '' : 'rounded-xl',
      ].join(' ')}
    >
      <Sidebar active={activeNav} onNavigate={setActiveNav} />

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

// Its own focus group so the rows bubble up to it (card -> row -> content), and
// `saveLastFocusedChild` restores the last card when focus returns from the
// sidebar/header. `focusKey: 'content'` lets App set the initial focus here.
function Content({ onHighlight }: ContentProps) {
  const { ref, focusKey } = useFocusable({
    focusKey: 'content',
    saveLastFocusedChild: true,
  });

  return (
    <FocusContext.Provider value={focusKey}>
      <main ref={ref} className="no-scrollbar flex-1 overflow-y-auto px-8 pb-12">
        <div className="flex flex-col gap-10">
          {ROWS.map((row) => (
            <CardRow key={row.title} title={row.title}>
              {row.items.map((item) => (
                <FocusableCard key={item} label={item} onHighlight={onHighlight} />
              ))}
            </CardRow>
          ))}
        </div>
      </main>
    </FocusContext.Provider>
  );
}
