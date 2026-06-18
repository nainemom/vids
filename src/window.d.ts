import type { Source } from './useSources'
import type { LibraryItem } from './library'

/** Persisted playback settings (applied to mpv on launch). */
export type PlaybackSettings = {
  subtitleSize: number
  subtitleColor: 'white' | 'yellow'
}

// Renderer-side types for the bridge exposed in electron/preload.ts
export interface AppBridge {
  close: () => void
  toggleFullscreen: () => void
  /** Reads the persisted sources from ~/.config/vids/sources.json. */
  readSources: () => Promise<Source[]>
  /** Writes the full list of sources to ~/.config/vids/sources.json. */
  writeSources: (sources: Source[]) => Promise<void>
  /** Scans a source for vids.json markers and returns its media items. */
  scanSource: (source: Source) => Promise<LibraryItem[]>
  /** Reads playback settings from ~/.config/vids/settings.json. */
  readSettings: () => Promise<PlaybackSettings>
  /** Writes playback settings to ~/.config/vids/settings.json. */
  writeSettings: (settings: PlaybackSettings) => Promise<void>
  /** Plays a video in a separate fullscreen mpv window (closes on focus loss). */
  playVideo: (videoPath: string, sources: Source[]) => Promise<void>
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
