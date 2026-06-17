import { useLocation, useParams } from 'wouter';
import { DetailView } from '../components/DetailView';
import { ListItem } from '../components/ListItem';
import { findItemById, useEnsureLibrary } from '../library';

// A movie's video files (movies have no groups). Selecting a video is a no-op
// for now (playback lands later).
export function MovieDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { items, status } = useEnsureLibrary();

  const item = id ? findItemById(items, id) : undefined;
  const movie = item?.type === 'movie' ? item : undefined;
  const back = () => navigate('/');

  if (!movie) {
    return (
      <DetailView title={status === 'ready' ? 'Not found' : 'Loading…'} onBack={back}>
        {status === 'ready' && (
          <p className="px-1 text-neutral-500">This movie is no longer available.</p>
        )}
      </DetailView>
    );
  }

  return (
    <DetailView title={movie.name} onBack={back}>
      {movie.videos.map((video) => (
        <ListItem key={video.path} label={video.name} />
      ))}
    </DetailView>
  );
}
