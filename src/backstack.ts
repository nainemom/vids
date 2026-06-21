// A tiny stack of "back" handlers for transient overlays (dialogs). The global
// remote-key handler (see useRemoteKeys in App.tsx) consults this first: when the
// user presses Back/Escape and an overlay is open, we dismiss the top overlay
// instead of navigating up a route — so Back closes a dialog rather than leaving
// the whole page. Kept out of the React tree (like src/highlight.ts) so the
// window-level key listener can reach it without prop-drilling.

const stack: Array<() => void> = [];

/**
 * Register a dismiss handler while an overlay is mounted. Returns an unregister
 * function — call it on unmount. Most-recently registered is dismissed first.
 */
export const pushBackHandler = (handler: () => void): (() => void) => {
  stack.push(handler);
  return () => {
    const i = stack.lastIndexOf(handler);
    if (i >= 0) stack.splice(i, 1);
  };
};

/**
 * Dismiss the top overlay, if any. Returns true when one was handled (so the
 * caller should swallow the key and skip route navigation), false when the
 * stack is empty.
 */
export const handleBack = (): boolean => {
  const handler = stack[stack.length - 1];
  if (!handler) return false;
  handler();
  return true;
};
