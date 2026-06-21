import { useLocation, useParams } from 'wouter';
import { DetailView } from '../components/DetailView';
import { ListItem } from '../components/ListItem';
import { findItemById, useEnsureLibrary, type Video } from '../library';
import { progressFor, useProgress } from '../progress';
import { useHighlightTarget } from '../highlight';
import { useSources } from '../useSources';

// A movie's video files (movies have no groups). Selecting a video plays it in a
// separate fullscreen mpv window.
export function MovieDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { items, status } = useEnsureLibrary();
  const { sources } = useSources();
  const progress = useProgress();
  // Set when opened from "Continue watching": focus the resume video on mount.
  const highlight = useHighlightTarget();

  const item = id ? findItemById(items, id) : undefined;
  const movie = item?.type === 'movie' ? item : undefined;
  const back = () => navigate('/');

  const play = (video: Video) => {
    window.app?.playVideo(video.path, sources, video.hash);
  };

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
        <ListItem
          key={video.path}
          label={video.name}
          progress={progressFor(progress, video.hash)}
          autoFocus={!!video.hash && video.hash === highlight}
          onSelect={() => play(video)}
        />
      ))}
    </DetailView>
  );
}
