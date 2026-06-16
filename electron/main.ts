import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Sources are persisted as JSON under the user's config directory.
const CONFIG_DIR = path.join(os.homedir(), '.config', 'vids')
const SOURCES_FILE = path.join(CONFIG_DIR, 'sources.json')

// No application menu — this is a 10-foot UI driven entirely by the remote.
Menu.setApplicationMenu(null)

app.whenReady().then(() => {
  const win = new BrowserWindow({
    title: 'Vids',
    // Frameless: no OS title bar or borders. Window controls live in the
    // in-app header (see src/components/Header.tsx -> electron/preload.ts).
    frame: false,
    autoHideMenuBar: true,
    // Transparent so the rounded corners (applied in CSS to the app root)
    // reveal the desktop instead of black corners. Requires a compositor.
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      // Built alongside main.js in dist-electron (see vite.config.ts)
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // You can use `process.env.VITE_DEV_SERVER_URL` when the vite command is called `serve`
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    // Load your file
    win.loadFile('dist/index.html')
  }

  // Header buttons -> window controls
  ipcMain.on('app:close', () => win.close())
  ipcMain.on('app:toggle-fullscreen', () =>
    win.setFullScreen(!win.isFullScreen()),
  )

  // Read the persisted sources. Missing/invalid file -> no sources yet.
  ipcMain.handle('sources:read', async () => {
    try {
      const raw = await fs.readFile(SOURCES_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  // Write the full list of sources, creating the config dir if needed.
  ipcMain.handle('sources:write', async (_event, sources) => {
    await fs.mkdir(CONFIG_DIR, { recursive: true })
    await fs.writeFile(SOURCES_FILE, JSON.stringify(sources, null, 2), 'utf-8')
  })

  // Fullscreen state -> renderer (used to drop rounded corners in fullscreen)
  ipcMain.handle('app:is-fullscreen', () => win.isFullScreen())
  win.on('enter-full-screen', () =>
    win.webContents.send('app:fullscreen-changed', true),
  )
  win.on('leave-full-screen', () =>
    win.webContents.send('app:fullscreen-changed', false),
  )
})
