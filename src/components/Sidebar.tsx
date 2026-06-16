import type { ComponentType } from 'react';
import { useLocation } from 'wouter';
import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { Home, Search, FolderOpen, Settings, Film } from 'lucide-react';

type IconProps = { className?: string };

/** The nav rail items and the route each one navigates to. */
const NAV_ITEMS: { path: string; label: string; Icon: ComponentType<IconProps> }[] =
  [
    { path: '/', label: 'Home', Icon: Home },
    { path: '/search', label: 'Search', Icon: Search },
    { path: '/sources', label: 'Source', Icon: FolderOpen },
    { path: '/settings', label: 'Settings', Icon: Settings },
  ];

/** Collapsed (always-reserved) and expanded (overlay) widths. */
export const SIDEBAR_COLLAPSED = '5rem'; // w-20
export const SIDEBAR_EXPANDED = '15rem'; // w-60

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
        'flex h-14 items-center gap-4 rounded-xl transition-all duration-200',
        expanded ? 'justify-start px-4' : 'justify-center px-0',
        focused
          ? 'bg-white text-black'
          : active
            ? 'text-sky-400'
            : 'text-neutral-400',
      ].join(' ')}
    >
      <Icon className="h-7 w-7 shrink-0" />
      <span
        className={[
          'overflow-hidden whitespace-nowrap text-lg font-medium transition-opacity duration-200',
          expanded ? 'opacity-100' : 'w-0 opacity-0',
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
            'absolute inset-y-0 left-0 flex flex-col gap-2 p-3',
            'transition-[width] duration-200 ease-out',
            expanded ? 'bg-neutral-900 shadow-2xl' : 'bg-transparent',
          ].join(' ')}
        >
          <div className="mb-4 flex h-14 items-center gap-3 px-1 text-white">
            <Film className="h-8 w-8 shrink-0 text-sky-400" />
            <span
              className={[
                'overflow-hidden whitespace-nowrap text-xl font-bold transition-opacity duration-200',
                expanded ? 'opacity-100' : 'w-0 opacity-0',
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
