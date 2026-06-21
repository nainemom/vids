import { contextBridge, ipcRenderer } from 'electron'

// Safe bridge exposed to the renderer as `window.app`. The header's
// close / fullscreen buttons call these instead of touching Electron directly.
contextBridge.exposeInMainWorld('app', {
  close: () => ipcRenderer.send('app:close'),
  toggleFullscreen: () => ipcRenderer.send('app:toggle-fullscreen'),
  // Persisted sources, stored as JSON under ~/.config/vids.
  readSources: () => ipcRenderer.invoke('sources:read'),
  writeSources: (sources: unknown) =>
    ipcRenderer.invoke('sources:write', sources),
  // Scan a source for vids.json markers; returns its movies/series tree.
  scanSource: (source: unknown) => ipcRenderer.invoke('library:scan', source),
  // Probe an SSH source; returns a classified result (connected / untrusted /
  // auth / network / path / changed host key) for the add-source form.
  testSshSource: (source: unknown) => ipcRenderer.invoke('ssh:test', source),
  // Open a terminal with native `ssh` so the user can trust the host on first
  // connect and log in interactively.
  openSshTerminal: (source: unknown) => ipcRenderer.invoke('ssh:open-terminal', source),
  // Read/write playback settings (subtitle size/colour).
  readSettings: () => ipcRenderer.invoke('settings:read'),
  writeSettings: (settings: unknown) => ipcRenderer.invoke('settings:write', settings),
  // Play a video in a separate fullscreen mpv window (closes on focus loss).
  // `hash` (when known) keys the watch-progress mpv records while playing.
  playVideo: (videoPath: string, sources: unknown, hash?: string) =>
    ipcRenderer.invoke('video:play', videoPath, sources, hash),
  // Watch-progress map { hash: percent } persisted under ~/.config/vids.
  readProgress: () => ipcRenderer.invoke('progress:read'),
  // Subscribe to live progress updates (mpv writes them while playing); returns
  // an unsubscribe function.
  onProgressChange: (callback: (progress: Record<string, number>) => void) => {
    const listener = (_event: unknown, progress: Record<string, number>) =>
      callback(progress)
    ipcRenderer.on('progress:changed', listener)
    return () => ipcRenderer.removeListener('progress:changed', listener)
  },
  // Current fullscreen state of the window.
  isFullscreen: () => ipcRenderer.invoke('app:is-fullscreen'),
  // Subscribe to fullscreen changes (header toggle, OS shortcut); returns an
  // unsubscribe function. Drives the in-app rounded corners.
  onFullscreenChange: (callback: (isFullscreen: boolean) => void) => {
    const listener = (_event: unknown, isFullscreen: boolean) =>
      callback(isFullscreen)
    ipcRenderer.on('app:fullscreen-changed', listener)
    return () => ipcRenderer.removeListener('app:fullscreen-changed', listener)
  },
})
