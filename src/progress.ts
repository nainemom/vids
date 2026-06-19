import { useSyncExternalStore } from 'react';
import type { ProgressMap } from './window';

// Live watch-progress: a video's identity hash -> percentage watched (0-100).
// mpv records this to ~/.config/vids/progress.json as it plays (see electron's
// progress-tracker Lua); the main process watches that file and pushes updates,
// so the bars/badges in the UI move without a manual refresh.
//
// A tiny external store (like src/library.ts) keeps this independent of the React
// tree: it's loaded once and shared across every page that shows progress.

/**
 * A video counts as "in progress" once meaningfully started but before it's
 * effectively finished. These bound that band so a stray first second or the
 * final credits don't light up the resume badge.
 */
export const STARTED_PERCENT = 1;
export const FINISHED_PERCENT = 95;

/** Whether a percentage falls in the "started but not finished" band. */
export const isInProgress = (percent: number | undefined): boolean =>
  percent !== undefined &&
  percent >= STARTED_PERCENT &&
  percent < FINISHED_PERCENT;

let progress: ProgressMap = {};
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

// Wire up to the main process lazily, the first time anything subscribes (so it
// no-ops in browser dev where `window.app` is absent). The push subscription
// lives for the app's lifetime, so its unsubscribe is intentionally dropped.
let started = false;
const ensureStarted = () => {
  if (started) return;
  started = true;
  window.app?.readProgress().then((initial) => {
    progress = initial ?? {};
    emit();
  });
  window.app?.onProgressChange((next) => {
    progress = next ?? {};
    emit();
  });
};

const subscribe = (listener: () => void) => {
  ensureStarted();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Subscribe a component to the live watch-progress map. */
export const useProgress = (): ProgressMap =>
  useSyncExternalStore(subscribe, () => progress);

/** The progress percentage for a video by its hash, if any has been recorded. */
export const progressFor = (
  map: ProgressMap,
  hash: string | undefined,
): number | undefined => (hash ? map[hash] : undefined);
