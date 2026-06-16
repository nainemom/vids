import { CardRow } from '../components/CardRow';
import { FocusableCard } from '../components/FocusableCard';

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

type HomeProps = {
  onHighlight: (label: string) => void;
};

export function Home({ onHighlight }: HomeProps) {
  return (
    <div className="flex flex-col gap-6">
      {ROWS.map((row) => (
        <CardRow key={row.title} title={row.title}>
          {row.items.map((item) => (
            <FocusableCard key={item} label={item} onHighlight={onHighlight} />
          ))}
        </CardRow>
      ))}
    </div>
  );
}
