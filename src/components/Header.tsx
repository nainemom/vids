import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';

/** A right-aligned button in the header (e.g. Home's Refresh). */
export type HeaderAction = {
  /** Stable key for React + spatial-navigation. */
  key: string;
  label: string;
  onPress: () => void;
};

type HeaderButtonProps = {
  onPress: () => void;
  children: ReactNode;
};

function HeaderButton({ onPress, children }: HeaderButtonProps) {
  const { ref, focused } = useFocusable({ onEnterPress: onPress });

  return (
    <div
      ref={ref}
      onClick={onPress}
      className={[
        'flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-4 py-2 font-medium select-none transition-all duration-150',
        focused ? 'bg-white text-black' : 'bg-neutral-800 text-neutral-200',
      ].join(' ')}
    >
      {children}
    </div>
  );
}

type HeaderProps = {
  /** Left of the title; defaults to "Vids" when omitted. */
  title?: string;
  subtitle?: string;
  /** When set, a Back button is shown that calls this. */
  back?: () => void;
  actions?: HeaderAction[];
};

/**
 * Top bar of a page: an optional Back button on the left, the title/subtitle,
 * and optional action buttons on the right. Rendered by each page (via Page) so
 * it sits above the scrolling body and stays put as the body scrolls. When the
 * page supplies focusable controls (Back or actions) the bar becomes its own
 * focus group, reached by pressing ↑ from the content; with no controls it's a
 * plain title and the engine skips over it.
 */
export function Header({ title, subtitle, back, actions }: HeaderProps) {
  const hasControls = Boolean(back) || (actions?.length ?? 0) > 0;
  // Always a registered group (so the Back/action buttons have a parent), but
  // only focus-targetable when it has controls — otherwise ↑ from the content
  // would land on an empty, invisible bar.
  const { ref, focusKey } = useFocusable({
    focusable: hasControls,
    saveLastFocusedChild: true,
  });

  return (
    <FocusContext.Provider value={focusKey}>
      <header
        ref={ref}
        className="flex shrink-0 items-center gap-4 py-4 pr-6 pl-4"
      >
        {back && (
          <HeaderButton onPress={back}>
            <ArrowLeft className="h-5 w-5" />
            Back
          </HeaderButton>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl font-bold text-white">
            {title ?? 'Vids'}
          </h1>
          {subtitle && (
            <p className="truncate text-sm text-neutral-400">{subtitle}</p>
          )}
        </div>
        {actions?.map((action) => (
          <HeaderButton key={action.key} onPress={action.onPress}>
            {action.label}
          </HeaderButton>
        ))}
      </header>
    </FocusContext.Provider>
  );
}
