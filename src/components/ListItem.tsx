import { useEffect } from 'react';
import { History } from 'lucide-react';
import { setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';

type ListItemProps = {
  label: string;
  /** Optional secondary text shown on the right (e.g. a current value/path). */
  hint?: string;
  /**
   * Watch progress (0-100) for a video row. When set, a progress bar is drawn
   * along the bottom edge and the percentage is shown on the right (unless a
   * `hint` already occupies it).
   */
  progress?: number;
  /**
   * Shows a "continue watching" icon beside the label — used for group rows
   * (seasons) that contain a partly-watched video.
   */
  inProgress?: boolean;
  /**
   * Take focus on mount — used to land on the resume target when a detail page
   * is opened from "Continue watching".
   */
  autoFocus?: boolean;
  onSelect?: () => void;
};

/**
 * A focusable full-width row used by the simpler list-style pages (Sources,
 * Settings, Search) and the video lists. Same focus styling language as
 * FocusableCard so the whole app reacts consistently to the remote/arrow keys.
 */
export function ListItem({ label, hint, progress, inProgress, autoFocus, onSelect }: ListItemProps) {
  const { ref, focused, focusKey } = useFocusable({
    onEnterPress: () => onSelect?.(),
    // Keep the focused row on-screen as the list scrolls (long video lists).
    onFocus: ({ node }) => node?.scrollIntoView({ block: 'center', behavior: 'smooth', inline: 'center' }),
  });

  // Claim focus once we're the resume target. Deferred a tick so it lands after
  // Page's mount effect parks focus on the body's first child (child effects run
  // before the parent's) — otherwise that would override us. onFocus then scrolls
  // this row into view.
  useEffect(() => {
    if (!autoFocus) return;
    const id = setTimeout(() => setFocus(focusKey), 0);
    return () => clearTimeout(id);
  }, [autoFocus, focusKey]);

  // Clamp into [0, 100]; treat anything below 1% as "not started" (no bar).
  const pct =
    typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : undefined;
  const showBar = pct !== undefined && pct >= 1;
  const rightText = hint ?? (showBar ? `${Math.round(pct!)}%` : undefined);

  return (
    <div
      ref={ref}
      className={[
        'relative flex items-center justify-between overflow-hidden rounded-xl px-6 py-5 transition-all duration-150',
        focused
          ? 'bg-white text-black'
          : 'bg-neutral-800 text-neutral-200',
      ].join(' ')}
    >
      <span className="flex min-w-0 items-center gap-3">
        {inProgress && (
          <History
            className={['h-5 w-5 shrink-0', focused ? 'text-sky-600' : 'text-sky-400'].join(' ')}
          />
        )}
        <span className="truncate text-xl font-medium">{label}</span>
      </span>
      {rightText && (
        <span className={focused ? 'text-neutral-500' : 'text-neutral-400'}>
          {rightText}
        </span>
      )}
      {showBar && (
        <div
          className={[
            'absolute inset-x-0 bottom-0 h-1',
            focused ? 'bg-black/10' : 'bg-white/10',
          ].join(' ')}
        >
          <div
            className={focused ? 'h-full bg-sky-600' : 'h-full bg-sky-500'}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
