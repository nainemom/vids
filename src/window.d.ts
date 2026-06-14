// Renderer-side types for the bridge exposed in electron/preload.ts
export interface AppBridge {
  close: () => void
  toggleFullscreen: () => void
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
