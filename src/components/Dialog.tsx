import { useEffect, useRef, type ReactNode } from 'react';
import {
  FocusContext,
  getCurrentFocusKey,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { FocusableButton } from './FocusableButton';

export type DialogAction = {
  label?: string;
  onPress: () => void;
  /** Optional leading icon (e.g. an arrow on Back, a check on OK). */
  icon?: ReactNode;
  disabled?: boolean;
};

type DialogProps = {
  title: string;
  /** Body content; scrolls when it outgrows the dialog. */
  children: ReactNode;
  /** Footer buttons, rendered left-to-right. */
  actions?: DialogAction[];
  /** Called on a backdrop click (the remote uses a Cancel-style action instead). */
  onClose: () => void;
};

// A nested focus group. The body and footer are separate groups so the engine
// navigates within one (e.g. between fields) before bubbling up to the other.
// Without this they'd be flat siblings, and a scrolled field's drifting
// position could let Down jump straight to the footer, skipping later fields.
function FocusGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { ref, focusKey } = useFocusable({ saveLastFocusedChild: true });
  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className={className}>
        {children}
      </div>
    </FocusContext.Provider>
  );
}

/**
 * A modal dialog tailored to the spatial-navigation UI:
 *  - `isFocusBoundary` traps arrow navigation inside while it's open.
 *  - Focus is pulled in on open and handed back to the triggering element on
 *    close, so the remote returns to where it was.
 *  - The body scrolls on overflow; focused children scroll themselves into view
 *    (see FocusableButton / focusable fields).
 */
export function Dialog({ title, children, actions, onClose }: DialogProps) {
  const { ref, focusKey } = useFocusable({
    isFocusBoundary: true,
    saveLastFocusedChild: true,
  });

  const returnFocusKey = useRef('');
  useEffect(() => {
    returnFocusKey.current = getCurrentFocusKey();
    setFocus(focusKey);
    return () => {
      if (returnFocusKey.current) setFocus(returnFocusKey.current);
    };
  }, [focusKey]);

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
        onClick={onClose}
      >
        <div
          ref={ref}
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-neutral-900 shadow-2xl"
        >
          <h3 className="shrink-0 px-6 pt-6 pb-4 text-xl font-semibold text-white">
            {title}
          </h3>

          {/* The body scrolls on overflow. It pads itself (and reserves
              scroll-padding) so a focused child's ring/scale is never clipped
              by the overflow edge, and lands with room rather than pinned to it. */}
          <FocusGroup className="no-scrollbar flex min-h-0 flex-col gap-4 overflow-y-auto px-6 py-3 scroll-py-6">
            {children}
          </FocusGroup>

          {actions && actions.length > 0 && (
            <FocusGroup className="flex shrink-0 justify-end gap-3 px-6 pt-4 pb-6">
              {actions.map((action) => (
                <FocusableButton
                  key={action.label}
                  label={action.label}
                  icon={action.icon}
                  onPress={action.onPress}
                  disabled={action.disabled}
                />
              ))}
            </FocusGroup>
          )}
        </div>
      </div>
    </FocusContext.Provider>
  );
}
