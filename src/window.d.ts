import type { Source } from './useSources'

// Renderer-side types for the bridge exposed in electron/preload.ts
export interface AppBridge {
  close: () => void
  toggleFullscreen: () => void
  /** Reads the persisted sources from ~/.config/vids/sources.json. */
  readSources: () => Promise<Source[]>
  /** Writes the full list of sources to ~/.config/vids/sources.json. */
  writeSources: (sources: Source[]) => Promise<void>
  isFullscreen: () => Promise<boolean>
  /** Subscribe to fullscreen changes; returns an unsubscribe function. */
  onFullscreenChange: (callback: (isFullscreen: boolean) => void) => () => void
}

declare global {
  interface Window {
    app: AppBridge
  }
}

export {}
