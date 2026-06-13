import type { ReactNode } from 'react';
import {
  FocusContext,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';

type CardRowProps = {
  title: string;
  children: ReactNode;
};

/**
 * Groups its children into one focus context. Wrapping focusable items in a
 * group lets the engine treat the row as a unit: ←/→ moves between cards inside
 * the row, ↑/↓ jumps to the adjacent row. The row also remembers which card was
 * focused, so returning to it restores that card (`saveLastFocusedChild`).
 */
export function CardRow({ title, children }: CardRowProps) {
  const { ref, focusKey } = useFocusable({
    saveLastFocusedChild: true,
  });

  return (
    <FocusContext.Provider value={focusKey}>
      <section className="flex flex-col gap-3">
        <h2 className="px-1 text-lg font-semibold text-neutral-400">{title}</h2>
        {/* py gives the focused card's scale + ring room so they aren't clipped */}
        <div ref={ref} className="no-scrollbar flex gap-6 overflow-x-auto px-2 py-3">
          {children}
        </div>
      </section>
    </FocusContext.Provider>
  );
}
