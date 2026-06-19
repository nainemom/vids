import { useState } from 'react';
import { Film, Tv, History } from 'lucide-react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';

type FocusableCardProps = {
  title: string;
  /** Picks the placeholder icon when there's no cover: Tv for series, Film for movie. */
  kind?: 'movie' | 'series';
  /** Loadable cover image URL; falls back to a placeholder if absent or broken. */
  cover?: string;
  poster?: string;
  /** Shows a "continue watching" badge on the cover when the title has a partly-watched video. */
  inProgress?: boolean;
  /** Called when the user presses Enter / the remote's OK button while focused. */
  onSelect?: () => void;
};

// Where the focused card should land in the viewport. `scrollIntoView` walks up
// every scrollable ancestor, so one call handles BOTH the horizontal row
// container and the vertical page at once.
const SCROLL_OPTIONS: ScrollIntoViewOptions = {
  behavior: 'smooth',
  block: 'center',
  inline: 'center',
};

/**
 * A poster tile: the cover image fills the top, a footer beneath it holds the
 * title. Only the footer reacts to focus (turning white) — the cover stays
 * as-is. The `focused` flag flips as the user navigates with the arrow keys /
 * remote D-pad; on focus we scroll the card into view.
 */
export function FocusableCard({ title, kind, cover, poster, inProgress, onSelect }: FocusableCardProps) {
  const { ref, focused } = useFocusable({
    onEnterPress: () => onSelect?.(),
    onFocus: ({ node }) => node?.scrollIntoView(SCROLL_OPTIONS),
  });

  const [failed, setFailed] = useState(false);
  const showImg = (Boolean(poster) || Boolean(cover)) && !failed;
  const Icon = kind === 'series' ? Tv : Film;

  return (
    <div
      ref={ref}
      className={["flex h-80 w-48 shrink-0 cursor-pointer flex-col overflow-hidden rounded-2xl select-none transition-colors duration-150", focused ? 'bg-white text-black' : 'bg-neutral-800 text-neutral-300',].join(' ')}
    >
      <div className={["relative flex flex-1 items-center justify-center bg-neutral-900 rounded-xl mx-1 mt-1 overflow-hidden transition-all duration-200", focused ? '' : 'grayscale-50'].join(' ')}>
        {showImg ? (
          <img
            src={poster || cover}
            alt=""
            onError={() => setFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <Icon className="h-10 w-10 text-neutral-700" />
        )}

        {/* "Continue watching" badge: this title has a partly-watched video. */}
        {inProgress && (
          <div className="absolute top-2 right-2 rounded-full bg-sky-500 p-1.5 text-white shadow-md">
            <History className="h-4 w-4" />
          </div>
        )}
      </div>

      <div
        className='px-4 py-3'
      >
        <p className="truncate text-base leading-snug font-medium">{title}</p>
      </div>
    </div>
  );
}
