import { useEffect, useState } from 'react';
import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { CardRow } from './components/CardRow';
import { FocusableCard } from './components/FocusableCard';

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
  // The page itself is a focus group. Focusing it on mount cascades focus down
  // to the first focusable card, so the remote works immediately.
  const { ref, focusKey, focusSelf } = useFocusable();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    focusSelf();
  }, [focusSelf]);

  return (
    <FocusContext.Provider value={focusKey}>
      <main
        ref={ref}
        className="no-scrollbar h-screen overflow-y-auto bg-neutral-950 p-12 text-white"
      >
        <header className="mb-10 flex items-baseline justify-between">
          <h1 className="text-4xl font-bold">Vids</h1>
          <p className="text-neutral-500">
            {selected ? (
              <>
                Selected: <span className="text-sky-400">{selected}</span>
              </>
            ) : (
              'Use the arrow keys / remote — press Enter to select'
            )}
          </p>
        </header>

        <div className="flex flex-col gap-10">
          {ROWS.map((row) => (
            <CardRow key={row.title} title={row.title}>
              {row.items.map((item) => (
                <FocusableCard key={item} label={item} onSelect={setSelected} />
              ))}
            </CardRow>
          ))}
        </div>
      </main>
    </FocusContext.Provider>
  );
}
