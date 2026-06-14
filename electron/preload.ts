import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

// Safe bridge exposed to the renderer as `window.app`. The header's
// close / fullscreen buttons call these instead of touching Electron directly.
contextBridge.exposeInMainWorld('app', {
  close: () => ipcRenderer.send('app:close'),
  toggleFullscreen: () => ipcRenderer.send('app:toggle-fullscreen'),
  isFullscreen: (): Promise<boolean> => ipcRenderer.invoke('app:is-fullscreen'),
  // Subscribe to fullscreen changes; returns an unsubscribe function.
  onFullscreenChange: (callback: (isFullscreen: boolean) => void) => {
    const listener = (_event: IpcRendererEvent, value: boolean) =>
      callback(value)
    ipcRenderer.on('app:fullscreen-changed', listener)
    return () => ipcRenderer.removeListener('app:fullscreen-changed', listener)
  },
})
