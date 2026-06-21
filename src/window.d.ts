import type { Source, SshSource, SshTestResult } from './useSources'
import type { LibraryItem } from './library'

/** Persisted app settings (subtitles applied to mpv; startup window mode). */
export type PlaybackSettings = {
  subtitleSize: number
  subtitleColor: 'white' | 'yellow'
  /** Open the main window fullscreen (true) or windowed (false) on launch. */
  startFullscreen: boolean
}

/** Watch progress, keyed by a video's identity hash -> percent watched (0-100). */
export type ProgressMap = Record<string, number>

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
  /** Probes an SSH source and classifies the result for the add-source form. */
  testSshSource: (source: SshSource) => Promise<SshTestResult>
  /**
   * Opens a terminal running native `ssh` to the host so the user can trust it
   * on first connect (writing known_hosts) and log in. Resolves with which
   * terminal launched, or an error message if none could be found.
   */
  openSshTerminal: (source: SshSource) => Promise<{ ok: boolean; message?: string }>
  /** Reads playback settings from ~/.config/vids/settings.json. */
  readSettings: () => Promise<PlaybackSettings>
  /** Writes playback settings to ~/.config/vids/settings.json. */
  writeSettings: (settings: PlaybackSettings) => Promise<void>
  /**
   * Plays a video in a separate fullscreen mpv window (closes on focus loss).
   * `hash` keys the watch-progress mpv records as it plays.
   */
  playVideo: (videoPath: string, sources: Source[], hash?: string) => Promise<void>
  /** Reads the watch-progress map from ~/.config/vids/progress.json. */
  readProgress: () => Promise<ProgressMap>
  /** Subscribe to live watch-progress updates; returns an unsubscribe function. */
  onProgressChange: (callback: (progress: ProgressMap) => void) => () => void
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
