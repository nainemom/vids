import type { ComponentType } from 'react';
import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { X, Maximize } from 'lucide-react';

type IconProps = { className?: string };

type IconButtonProps = {
  Icon: ComponentType<IconProps>;
  label: string;
  onSelect: () => void;
};

function IconButton({ Icon, label, onSelect }: IconButtonProps) {
  const { ref, focused } = useFocusable({ onEnterPress: onSelect });

  return (
    <button
      ref={ref}
      aria-label={label}
      className={[
        'flex h-12 w-12 items-center justify-center rounded-full transition-all duration-150',
        focused
          ? 'scale-110 bg-white text-black ring-4 ring-sky-400'
          : 'bg-neutral-800 text-neutral-300',
      ].join(' ')}
    >
      <Icon className="h-6 w-6" />
    </button>
  );
}

type HeaderProps = {
  /** Title of the currently highlighted card, or undefined for the default. */
  title?: string;
};

/**
 * Top bar: shows the highlighted card's title (falling back to "Vids") on the
 * left and the window controls on the right. The controls call the bridge
 * exposed by electron/preload.ts.
 */
export function Header({ title }: HeaderProps) {
  const { ref, focusKey } = useFocusable();

  return (
    <FocusContext.Provider value={focusKey}>
      <header
        ref={ref}
        className="flex shrink-0 items-center justify-between gap-6 py-6 pr-12 pl-4"
      >
        <h1 className="truncate text-3xl font-bold text-white">
          {title ?? 'Vids'}
        </h1>
        <div className="flex shrink-0 items-center gap-3">
          <IconButton
            Icon={Maximize}
            label="Toggle fullscreen"
            onSelect={() => window.app?.toggleFullscreen()}
          />
          <IconButton
            Icon={X}
            label="Close"
            onSelect={() => window.app?.close()}
          />
        </div>
      </header>
    </FocusContext.Provider>
  );
}
