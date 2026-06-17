import { useEffect, useSyncExternalStore } from 'react';
import { useSources, type Source } from './useSources';

// The scanned-library model. The scan itself runs in the Electron main process
// (it needs filesystem access — see electron/scan.ts) and returns these shapes
// over IPC. They're declared here, on the renderer side and free of any Node
// imports, so both the UI and the (type-only) main-process scanner can share one
// source of truth.

/** A single playable video file. */
export type Video = {
  /** Display name — from the `video` regex, or the file name without extension. */
  name: string;
  /** Absolute path to the file (provider-native; a local path today). */
  path: string;
};

/** A bucket of videos within a series — typically one season. */
export type Group = {
  /** Display name — the capture from the `group` regex. */
  name: string;
  videos: Video[];
};

/** A movie: one or more video files with no grouping. */
export type MovieItem = {
  /** Stable id derived from the path; used to address the item in a route. */
  id: string;
  type: 'movie';
  name: string;
  /** Loadable URL for the title's cover image, when configured and valid. */
  cover?: string;
  /** Absolute path of the directory that holds the vids.json. */
  path: string;
  videos: Video[];
};

/** A series: videos bucketed into groups (seasons) by the `group` regex. */
export type SeriesItem = {
  /** Stable id derived from the path; used to address the item in a route. */
  id: string;
  type: 'series';
  name: string;
  /** Loadable URL for the title's cover image, when configured and valid. */
  cover?: string;
  path: string;
  groups: Group[];
};

/** A scanned media item. Discriminated on `type` (mirrors the Source union). */
export type LibraryItem = MovieItem | SeriesItem;

export type LibraryStatus = 'idle' | 'loading' | 'ready';

// --- In-memory store --------------------------------------------------------
// We scan once and keep the result in module scope so it survives Home being
// unmounted/remounted as the user navigates. A re-scan only happens on an
// explicit Refresh. A tiny external store (vs. context) keeps this independent
// of the React tree and lets refreshLibrary be called from anywhere.

let items: LibraryItem[] = [];
let status: LibraryStatus = 'idle';
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Re-scan every source and replace the in-memory library. Concurrent calls share
 * the single in-flight scan. Safe when `window.app` is absent (browser dev): a
 * source that can't be scanned simply contributes nothing.
 */
export function refreshLibrary(sources: Source[]): Promise<void> {
  if (inflight) return inflight;
  status = 'loading';
  emit();
  inflight = (async () => {
    const results = await Promise.all(
      sources.map((source) =>
        (window.app?.scanSource(source) ?? Promise.resolve([])).catch(
          () => [] as LibraryItem[],
        ),
      ),
    );
    items = results.flat();
    status = 'ready';
    inflight = null;
    emit();
  })();
  return inflight;
}

/** Subscribe a component to the in-memory library and the current scan status. */
export function useLibrary() {
  const currentItems = useSyncExternalStore(subscribe, () => items);
  const currentStatus = useSyncExternalStore(subscribe, () => status);
  return { items: currentItems, status: currentStatus };
}

/** Find a scanned item by its stable id. */
export const findItemById = (items: LibraryItem[], id: string) =>
  items.find((item) => item.id === id);

/**
 * Ensure the library has been scanned (once), kicking off the scan as soon as
 * the sources have loaded. Shared by Home and the detail pages so that deep-
 * linking or reloading straight onto a detail route still triggers a scan.
 */
export function useEnsureLibrary() {
  const { sources, loaded } = useSources();
  const { items, status } = useLibrary();
  useEffect(() => {
    if (loaded && status === 'idle') refreshLibrary(sources);
  }, [loaded, status, sources]);
  return { items, status, sources };
}
