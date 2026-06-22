import type { ComponentType } from 'react';
import { useLocation } from 'wouter';
import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { Home, FolderOpen, Settings, Film } from 'lucide-react';

type IconProps = { className?: string };

/** The nav rail items and the route each one navigates to. */
const NAV_ITEMS: { path: string; label: string; Icon: ComponentType<IconProps> }[] =
  [
    { path: '/', label: 'Home', Icon: Home },
    { path: '/sources', label: 'Sources', Icon: FolderOpen },
    { path: '/settings', label: 'Settings', Icon: Settings },
  ];

/** Collapsed (always-reserved) and expanded (overlay) widths. */
export const SIDEBAR_COLLAPSED = '4.5rem';
export const SIDEBAR_EXPANDED = '15rem';

/**
 * Stable focus key for the nav rail. The focus guard (see App.tsx) targets it as
 * the universal fallback — the sidebar is the one focus group that's always
 * mounted with focusable children, so it can keep a highlight alive even when the
 * current page body has nothing to focus yet (empty/loading library).
 */
export const SIDEBAR_KEY = 'sidebar';

type NavItemProps = {
  label: string;
  Icon: ComponentType<IconProps>;
  expanded: boolean;
  active: boolean;
  onSelect: () => void;
};

function NavItem({ label, Icon, expanded, active, onSelect }: NavItemProps) {
  const { ref, focused } = useFocusable({ onEnterPress: onSelect });

  return (
    <div
      ref={ref}
      className={[
        'flex h-14 items-center rounded-xl transition-all duration-200 justify-center px-4',
        focused
          ? 'bg-white text-black'
          : active
            ? 'text-sky-400'
            : 'text-neutral-400',
      ].join(' ')}
    >
      <Icon className="size-7 shrink-0" />
      <span
        className={[
          'overflow-hidden whitespace-nowrap text-lg font-medium transition-all duration-200 shrink grow',
          expanded ? 'ms-4' : 'w-0 opacity-0',
        ].join(' ')}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * Icon-only rail that expands to show labels whenever focus is anywhere inside
 * it (`trackChildren` -> `hasFocusedChild`). Selecting an item routes to its
 * path via wouter; the active item is derived from the current location.
 *
 * IMPORTANT: the focusable <nav> keeps a FIXED collapsed width — that's the box
 * the navigation engine measures, so focus can always move right back into the
 * content. The expansion happens in an inner, absolutely-positioned panel that
 * overlays the content without growing the rail's measured box. (If the rail
 * itself grew, its right edge would pass the content's left edge and the engine
 * would no longer see the content as "to the right" — trapping focus inside.)
 */
export function Sidebar() {
  const { ref, focusKey, hasFocusedChild } = useFocusable({
    focusKey: SIDEBAR_KEY,
    trackChildren: true,
    saveLastFocusedChild: true,
  });
  const [location, setLocation] = useLocation();

  const expanded = hasFocusedChild;

  return (
    <FocusContext.Provider value={focusKey}>
      <nav
        ref={ref}
        style={{ width: SIDEBAR_COLLAPSED }}
        className="relative z-20 shrink-0"
      >
        <div
          style={{ width: expanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED }}
          className={[
            'absolute inset-y-0 left-0 flex flex-col gap-2 p-4',
            'transition-[width] duration-300 ease-in-out',
            expanded ? 'bg-neutral-900 shadow-2xl' : 'bg-neutral-900',
          ].join(' ')}
        >
          <div className="mb-4 flex h-14 items-center px-1 text-white">
            <Film className="size-8 shrink-0 text-sky-400" />
            <span
              className={[
                'overflow-hidden whitespace-nowrap text-xl font-bold transition-all duration-200 shrink grow',
                expanded ? 'ms-2' : 'w-0 opacity-0',
              ].join(' ')}
            >
              Vids
            </span>
          </div>

          {NAV_ITEMS.map(({ path, label, Icon }) => (
            <NavItem
              key={path}
              label={label}
              Icon={Icon}
              expanded={expanded}
              active={location === path}
              onSelect={() => setLocation(path)}
            />
          ))}
        </div>
      </nav>
    </FocusContext.Provider>
  );
}
