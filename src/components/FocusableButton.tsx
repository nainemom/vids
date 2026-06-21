import type { ReactNode } from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';

// Keep the focused button visible inside a scrolling dialog body. `nearest`
// scrolls just enough rather than recentering, and instant (`auto`) keeps quick
// arrow navigation responsive — the container's scroll-padding leaves the margin.
const SCROLL_OPTIONS: ScrollIntoViewOptions = {
  behavior: 'auto',
  block: 'nearest',
};

export type FocusableButtonProps = {
  label?: string;
  onPress: () => void;
  focusKey?: string;
  /** Optional leading icon (e.g. an arrow on Back, a check on OK). */
  icon?: ReactNode;
  /** Highlight as the chosen option (e.g. the active type chip). */
  selected?: boolean;
  disabled?: boolean;
};

/**
 * A focusable button reacting to the remote's OK (`onEnterPress`) and to mouse
 * clicks. Used for dialog actions, option chips and inline pickers.
 */
export function FocusableButton({
  label,
  onPress,
  focusKey,
  icon,
  selected,
  disabled,
}: FocusableButtonProps) {
  const press = () => {
    if (!disabled) onPress();
  };
  // Disabled buttons drop out of spatial navigation entirely, so the arrow keys
  // skip over them instead of letting focus land on something inert.
  const { ref, focused } = useFocusable({
    focusKey,
    focusable: !disabled,
    onEnterPress: press,
    onFocus: ({ node }) => node?.scrollIntoView(SCROLL_OPTIONS),
  });

  return (
    <div
      ref={ref}
      onClick={press}
      className={[
        'flex items-center justify-center gap-2 rounded-xl h-11 font-medium select-none transition-all duration-150',
        label ? 'px-4' : 'w-11',
        // Disabled buttons must not look pressable — otherwise a click reads as
        // a dead no-op ("clicks but does nothing") instead of "not ready yet".
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
        focused
          ? 'bg-white text-black'
          : selected
            ? 'bg-sky-500 text-white'
            : 'bg-neutral-800 text-neutral-200',
      ].join(' ')}
    >
      {icon}
      {label && <span className="truncate">{label}</span>}
    </div>
  );
}
