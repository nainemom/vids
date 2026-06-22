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
        <h2 className="text-lg font-semibold text-neutral-400">{title}</h2>
        {/* px/py give the focused card's scale + ring room so they aren't clipped
            by this scroll container (overflow-x also clips the y axis). The first
            and last cards can't scroll to center, so the inline padding is what
            keeps their ring fully visible at the row edges. */}
        <div ref={ref} className="no-scrollbar flex gap-6 overflow-x-auto">
          {children}
        </div>
      </section>
    </FocusContext.Provider>
  );
}
