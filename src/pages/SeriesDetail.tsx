import { useLocation, useParams } from 'wouter';
import { DetailView } from '../components/DetailView';
import { ListItem } from '../components/ListItem';
import { findItemById, useEnsureLibrary } from '../library';

// A series' groups (seasons). Selecting one drills into its videos.
export function SeriesDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { items, status } = useEnsureLibrary();

  const item = id ? findItemById(items, id) : undefined;
  const series = item?.type === 'series' ? item : undefined;
  const back = () => navigate('/');

  if (!series) {
    return (
      <DetailView title={status === 'ready' ? 'Not found' : 'Loading…'} onBack={back}>
        {status === 'ready' && (
          <p className="px-1 text-neutral-500">This series is no longer available.</p>
        )}
      </DetailView>
    );
  }

  return (
    <DetailView title={series.name} onBack={back}>
      {series.groups.map((group, index) => (
        <ListItem
          key={group.name}
          label={group.name}
          hint={`${group.videos.length} ${group.videos.length === 1 ? 'video' : 'videos'}`}
          onSelect={() => navigate(`/series/${series.id}/${index}`)}
        />
      ))}
    </DetailView>
  );
}
