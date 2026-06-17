import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';

type ListItemProps = {
  label: string;
  /** Optional secondary text shown on the right (e.g. a current value/path). */
  hint?: string;
  onSelect?: () => void;
};

/**
 * A focusable full-width row used by the simpler list-style pages (Sources,
 * Settings, Search). Same focus styling language as FocusableCard so the whole
 * app reacts consistently to the remote/arrow keys.
 */
export function ListItem({ label, hint, onSelect }: ListItemProps) {
  const { ref, focused } = useFocusable({
    onEnterPress: () => onSelect?.(),
    // Keep the focused row on-screen as the list scrolls (long video lists).
    onFocus: ({ node }) => node?.scrollIntoView({ block: 'center', behavior: 'smooth', inline: 'center' }),
  });

  return (
    <div
      ref={ref}
      className={[
        'flex items-center justify-between rounded-xl px-6 py-5 transition-all duration-150',
        focused
          ? 'bg-white text-black'
          : 'bg-neutral-800 text-neutral-200',
      ].join(' ')}
    >
      <span className="text-xl font-medium">{label}</span>
      {hint && (
        <span className={focused ? 'text-neutral-500' : 'text-neutral-400'}>
          {hint}
        </span>
      )}
    </div>
  );
}
