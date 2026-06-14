import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';

type FocusableCardProps = {
  label: string;
  /** Called when the user presses Enter / the remote's OK button while focused. */
  onSelect?: (label: string) => void;
  /** Called when this card becomes focused — used to drive the header title. */
  onHighlight?: (label: string) => void;
};

// Where the focused card should land in the viewport. `scrollIntoView` walks up
// every scrollable ancestor, so one call handles BOTH the horizontal row
// container and the vertical page at once. Tweak in one place:
//   block:  'nearest' = minimal vertical move | 'center' = keep row centered
//   inline: 'center'  = classic TV carousel   | 'nearest' = less horizontal motion
const SCROLL_OPTIONS: ScrollIntoViewOptions = {
  behavior: 'smooth',
  block: 'center',
  inline: 'center',
};

/**
 * A single focusable tile. The `focused` flag flips automatically as the user
 * navigates with the arrow keys / remote D-pad — we only have to style it. On
 * focus we scroll the element into view so it's never off-screen.
 */
export function FocusableCard({
  label,
  onSelect,
  onHighlight,
}: FocusableCardProps) {
  const { ref, focused } = useFocusable({
    onEnterPress: () => onSelect?.(label),
    onFocus: ({ node }) => {
      onHighlight?.(label);
      node?.scrollIntoView(SCROLL_OPTIONS);
    },
  });

  return (
    <div
      ref={ref}
      className={[
        'flex h-36 w-56 shrink-0 cursor-pointer select-none items-center justify-center',
        'rounded-2xl text-2xl font-medium transition-all duration-150 ease-out',
        focused
          ? 'scale-105 bg-white text-black shadow-2xl ring-4 ring-sky-400'
          : 'bg-neutral-800 text-neutral-300',
      ].join(' ')}
    >
      {label}
    </div>
  );
}
