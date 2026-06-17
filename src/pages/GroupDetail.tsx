import { useLocation, useParams } from 'wouter';
import { DetailView } from '../components/DetailView';
import { ListItem } from '../components/ListItem';
import { findItemById, useEnsureLibrary } from '../library';

// The videos within one group (season) of a series. Leaf of the drill-down;
// selecting a video is a no-op for now (playback lands later).
export function GroupDetail() {
  const { id, groupIndex } = useParams();
  const [, navigate] = useLocation();
  const { items, status } = useEnsureLibrary();

  const item = id ? findItemById(items, id) : undefined;
  const series = item?.type === 'series' ? item : undefined;
  const index = Number(groupIndex);
  const group =
    series && Number.isInteger(index) ? series.groups[index] : undefined;
  const back = () => navigate(id ? `/series/${id}` : '/');

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
        <ListItem key={video.path} label={video.name} />
      ))}
    </DetailView>
  );
}
