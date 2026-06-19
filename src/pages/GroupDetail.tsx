import { useLocation, useParams } from 'wouter';
import { DetailView } from '../components/DetailView';
import { ListItem } from '../components/ListItem';
import { findItemById, useEnsureLibrary, type Video } from '../library';
import { progressFor, useProgress } from '../progress';
import { useSources } from '../useSources';

// The videos within one group (season) of a series. Selecting a video plays it
// in a separate fullscreen mpv window.
export function GroupDetail() {
  const { id, groupIndex } = useParams();
  const [, navigate] = useLocation();
  const { items, status } = useEnsureLibrary();
  const { sources } = useSources();
  const progress = useProgress();

  const item = id ? findItemById(items, id) : undefined;
  const series = item?.type === 'series' ? item : undefined;
  const index = Number(groupIndex);
  const group =
    series && Number.isInteger(index) ? series.groups[index] : undefined;
  const back = () => navigate(id ? `/series/${id}` : '/');

  const play = (video: Video) => {
    window.app?.playVideo(video.path, sources, video.hash);
  };

  if (!series || !group) {
    return (
      <DetailView title={status === 'ready' ? 'Not found' : 'Loading…'} onBack={back}>
        {status === 'ready' && (
          <p className="px-1 text-neutral-500">This list is no longer available.</p>
        )}
      </DetailView>
    );
  }

  return (
    <DetailView title={group.name} subtitle={series.name} onBack={back}>
      {group.videos.map((video) => (
        <ListItem
          key={video.path}
          label={video.name}
          progress={progressFor(progress, video.hash)}
          onSelect={() => play(video)}
        />
      ))}
    </DetailView>
  );
}
