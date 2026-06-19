import { useLocation } from 'wouter';
import { CardRow } from '../components/CardRow';
import { FocusableCard } from '../components/FocusableCard';
import { Header } from '../components/Header';
import { Page } from '../components/Page';
import { refreshLibrary, useEnsureLibrary, videosOf, type LibraryItem } from '../library';
import { isInProgress, progressFor, useProgress } from '../progress';

// Route a card drills into: a series -> its groups, a movie -> its videos.
const itemHref = (item: LibraryItem) =>
  item.type === 'series' ? `/series/${item.id}` : `/movie/${item.id}`;

export function Home() {
  const { items, status, sources } = useEnsureLibrary();
  const [, navigate] = useLocation();
  const progress = useProgress();

  // A title shows the "continue watching" badge if any of its videos is in the
  // partly-watched band.
  const hasInProgress = (item: LibraryItem) =>
    videosOf(item).some((video) => isInProgress(progressFor(progress, video.hash)));

  // Aggregate across all sources into a Series row and a Movies row.
  const rows = [
    { title: 'Series', items: items.filter((i) => i.type === 'series') },
    { title: 'Movies', items: items.filter((i) => i.type === 'movie') },
  ].filter((row) => row.items.length > 0);

  return (
    <Page
      header={
        <Header
          title="Library"
          actions={[
            {
              key: 'refresh',
              label: status === 'loading' ? 'Scanning…' : 'Refresh',
              onPress: () => refreshLibrary(sources),
            },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-6">
        {rows.map((row) => (
          <CardRow key={row.title} title={row.title}>
            {row.items.map((item) => (
              <FocusableCard
                key={`${item.type}:${item.path}`}
                title={item.name}
                kind={item.type}
                cover={item.cover}
                poster={item.poster}
                inProgress={hasInProgress(item)}
                onSelect={() => navigate(itemHref(item))}
              />
            ))}
          </CardRow>
        ))}

        {rows.length === 0 && (
          <p className="px-1 text-neutral-500">
            {status === 'loading'
              ? 'Scanning your sources…'
              : sources.length === 0
                ? 'No sources yet. Add one in Sources to see your library.'
                : 'No movies or series found. Add a vids.json to a folder, then Refresh.'}
          </p>
        )}
      </div>
    </Page>
  );
}
