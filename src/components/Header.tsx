import type { ReactNode } from 'react';
import { ArrowLeft, Maximize2, Minimize2, X } from 'lucide-react';
import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { useFullscreen } from '../useFullscreen';
import { FocusableButton } from './FocusableButton';

/** A right-aligned button in the header (e.g. Home's Refresh). */
export type HeaderAction = {
  /** Stable key for React + spatial-navigation. */
  key: string;
  label?: string;
  /** Optional leading icon, shown before the label. */
  icon?: ReactNode;
  onPress: () => void;
};

/**
 * The fixed, focusable close / fullscreen-toggle controls pinned to the right of
 * every header — reachable by ↑ from the content like any other header button.
 * `window.app` is absent in browser dev, so the handlers no-op there.
 */
function WindowControls() {
  const isFullscreen = useFullscreen();

  return (
    // app-no-drag (inherited by the buttons) keeps clicks from being swallowed
    // by the header's drag region.
    <div className="app-no-drag flex shrink-0 items-center gap-2">
      <FocusableButton
        icon={
          isFullscreen ? (
            <Minimize2 className="size-5" />
          ) : (
            <Maximize2 className="size-5" />
          )
        }
        onPress={() => window.app?.toggleFullscreen()}
      />
      <FocusableButton
        icon={<X className="size-5" />}
        onPress={() => window.app?.close()}
      />
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
 * page action buttons, and the always-present window controls on the right.
 * Rendered by each page (via Page) so it sits above the scrolling body and stays
 * put as the body scrolls. Because the window controls are always present, the
 * bar is always a focus group reachable by pressing ↑ from the content.
 */
export function Header({ title, subtitle, back, actions }: HeaderProps) {
  const { ref, focusKey } = useFocusable({
    saveLastFocusedChild: true,
  });

  return (
    <FocusContext.Provider value={focusKey}>
      <header
        ref={ref}
        className="app-drag flex shrink-0 items-center gap-4 p-4"
      >
        {back && (
          <FocusableButton icon={<ArrowLeft className="size-5" />} label="Back" onPress={back} />
        )}
        <div className="flex min-w-0 flex-1 items-baseline gap-3">
          <h1 className="min-w-0 truncate text-2xl font-bold text-white">
            {title ?? 'Vids'}
          </h1>
          {subtitle && (
            <p className="shrink-0 truncate text-sm text-neutral-400">
              {subtitle}
            </p>
          )}
        </div>
        {actions?.map((action) => (
          <FocusableButton key={action.key} icon={action.icon} label={action.label} onPress={action.onPress} />
        ))}
        {actions?.length && <div className="h-5 w-px bg-neutral-700" />}
        <WindowControls />
      </header>
    </FocusContext.Provider>
  );
}
