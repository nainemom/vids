import { useEffect, useState } from 'react';

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
 * Read the pending highlight, once, for the lifetime of a detail page.
 *
 * The initializer is PURE — it only reads `pending`, never clears it. That
 * matters under React StrictMode, which double-invokes useState initializers in
 * development: an initializer that cleared `pending` would hand the second
 * invocation (the one whose result actually commits) an already-null value, so
 * the highlight was silently lost in dev and the page landed on its first row.
 *
 * Clearing happens in an effect instead, after the first commit, so a later
 * unrelated navigation to this same page doesn't re-apply a stale highlight. The
 * guard makes it idempotent (StrictMode runs the mount effect cycle twice) and
 * keeps it from clobbering a newer highlight set by a concurrent navigation.
 */
export const useHighlightTarget = (): string | null => {
  const [hash] = useState(() => pending);
  useEffect(() => {
    if (pending === hash) pending = null;
  }, [hash]);
  return hash;
};
