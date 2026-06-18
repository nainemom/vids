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
  // Read/write playback settings (subtitle size/colour).
  readSettings: () => ipcRenderer.invoke('settings:read'),
  writeSettings: (settings: unknown) => ipcRenderer.invoke('settings:write', settings),
  // Play a video in a separate fullscreen mpv window (closes on focus loss).
  playVideo: (videoPath: string, sources: unknown) =>
    ipcRenderer.invoke('video:play', videoPath, sources),
})
