import { useState } from 'react';

// A one-shot hand-off between Home's "Continue watching" cards and the detail
// page they open. Selecting a continue-watching title should drop the user
// straight onto its partly-watched video with that row pre-focused — but the
// target lives on the *next* page. Rather than thread it through the hash route,
// we stash the video's hash here, navigate, and let the detail page claim it on
// mount. It's a single pending value (only one navigation is ever in flight),
// kept out of the React tree like src/library.ts and src/progress.ts.

let pending: string | null = null;

/** Mark which video the next-opened detail page should focus. */
export const setHighlight = (hash: string | undefined): void => {
  pending = hash ?? null;
};

/**
 * Read and clear the pending highlight, once, for the lifetime of a detail page.
 * The useState initializer runs on first render, so the value is captured before
 * any sibling navigation can overwrite it and never re-fires on later renders.
 */
export const useHighlightTarget = (): string | null => {
  const [hash] = useState(() => {
    const target = pending;
    pending = null;
    return target;
  });
  return hash;
};
