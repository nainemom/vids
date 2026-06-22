import { useLocation } from 'wouter';
import { FolderOpen, RefreshCw } from 'lucide-react';
import { CardRow } from '../components/CardRow';
import { FocusableButton } from '../components/FocusableButton';
import { FocusableCard } from '../components/FocusableCard';
import { Header } from '../components/Header';
import { Page } from '../components/Page';
import { refreshLibrary, useEnsureLibrary, videosOf, type LibraryItem, type Video } from '../library';
import { isInProgress, progressFor, recencyIndex, useProgress } from '../progress';
import { setHighlight } from '../highlight';

// Route a card drills into: a series -> its groups, a movie -> its videos.
const itemHref = (item: LibraryItem) =>
  item.type === 'series' ? `/series/${item.id}` : `/movie/${item.id}`;

// The route that drops straight onto a specific video's list — a movie's lone
// video list, or the series group (season) that holds the video. Used by
// "Continue watching" to open the resume target's list directly.
const videoHref = (item: LibraryItem, video: Video): string => {
  if (item.type === 'movie') return `/movie/${item.id}`;
  const groupIndex = item.groups.findIndex((group) => group.videos.includes(video));
  return groupIndex >= 0 ? `/series/${item.id}/${groupIndex}` : `/series/${item.id}`;
};

/**
 * The most recently watched still-in-progress video of a title, with its recency
 * rank — or null if the title has none. The rank is the title's position in the
 * "Continue watching" order (a title surfaces by its newest partly-watched video).
 */
const latestInProgress = (
  item: LibraryItem,
  progress: ReturnType<typeof useProgress>,
  order: Record<string, number>,
): { video: Video; rank: number } | null => {
  let best: { video: Video; rank: number } | null = null;
  for (const video of videosOf(item)) {
    if (!video.hash || !isInProgress(progressFor(progress, video.hash))) continue;
    const rank = order[video.hash] ?? -1;
    if (!best || rank > best.rank) best = { video, rank };
  }
  return best;
};

export function Home() {
  const { items, status, sources } = useEnsureLibrary();
  const [, navigate] = useLocation();
  const progress = useProgress();

  // A title shows the "continue watching" badge if any of its videos is in the
  // partly-watched band.
  const hasInProgress = (item: LibraryItem) =>
    videosOf(item).some((video) => isInProgress(progressFor(progress, video.hash)));

  // Every title with a partly-watched video, newest first (progress.json is
  // written newest-last; see progress.recencyIndex). Selecting one opens its
  // resume video's list directly and focuses that row, rather than the title's
  // top-level page.
  const order = recencyIndex(progress);
  const continueWatching = items
    .map((item) => ({ item, latest: latestInProgress(item, progress, order) }))
    .filter((entry): entry is { item: LibraryItem; latest: { video: Video; rank: number } } =>
      entry.latest !== null,
    )
    .sort((a, b) => b.latest.rank - a.latest.rank);

  const openResume = (item: LibraryItem, video: Video) => {
    setHighlight(video.hash);
    navigate(videoHref(item, video));
  };

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
              icon: (
                <RefreshCw
                  className={`size-5 ${status === 'loading' ? 'animate-spin' : ''}`}
                />
              ),
              onPress: () => refreshLibrary(sources),
            },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-6">
        {continueWatching.length > 0 && (
          <CardRow title="Continue watching">
            {continueWatching.map(({ item, latest }) => (
              <FocusableCard
                key={`${item.type}:${item.path}`}
                title={item.name}
                kind={item.type}
                cover={item.cover}
                poster={item.poster}
                inProgress
                onSelect={() => openResume(item, latest.video)}
              />
            ))}
          </CardRow>
        )}

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

        {/*
          The empty state always renders a focusable action. Without one, the
          page body has no focusable leaf, so the only way out of the sidebar
          (the always-mounted fallback focus group) is back into an empty body —
          which the focus guard immediately bounces back to the sidebar, trapping
          focus there. A real button gives ← / → from the sidebar somewhere to
          land, and doubles as the action the user wants (add a source / refresh).
        */}
        {rows.length === 0 && (
          <div className="flex flex-col items-center py-12 gap-4 px-1">
            <p className="text-neutral-500">
              {status === 'loading'
                ? 'Scanning your sources…'
                : 'No movies or series found.'}
            </p>
            {sources.length === 0 ? (
              <FocusableButton
                label="Manage Sources"
                icon={<FolderOpen className="size-5" />}
                onPress={() => navigate('/sources')}
              />
            ) : (
              <FocusableButton
                label={status === 'loading' ? 'Scanning…' : 'Refresh'}
                icon={
                  <RefreshCw
                    className={`size-5 ${status === 'loading' ? 'animate-spin' : ''}`}
                  />
                }
                onPress={() => refreshLibrary(sources)}
              />
            )}
          </div>
        )}
      </div>
    </Page>
  );
}
