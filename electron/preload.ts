import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

// Safe bridge exposed to the renderer as `window.app`. The header's
// close / fullscreen buttons call these instead of touching Electron directly.
contextBridge.exposeInMainWorld('app', {
  close: () => ipcRenderer.send('app:close'),
  toggleFullscreen: () => ipcRenderer.send('app:toggle-fullscreen'),
  // Persisted sources, stored as JSON under ~/.config/vids.
  readSources: () => ipcRenderer.invoke('sources:read'),
  writeSources: (sources: unknown) =>
    ipcRenderer.invoke('sources:write', sources),
})
