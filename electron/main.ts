import { app, BrowserWindow, ipcMain, Menu, protocol } from 'electron'
import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { scanSource } from './scan'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Sources are persisted as JSON under the user's config directory.
const CONFIG_DIR = path.join(os.homedir(), '.config', 'vids')
const SOURCES_FILE = path.join(CONFIG_DIR, 'sources.json')

// Content types for the cover images we serve over the custom protocol.
const COVER_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
}

// Lets the renderer load local cover images via `vid-cover://cover/?path=<abs>`
// from both the dev server (http) and the packaged app (file://). Must be
// declared before `app.whenReady`. The path is produced by the scanner, which
// has already confirmed it lives inside a source root (see electron/scan.ts).
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'vid-cover',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
])

// No application menu — this is a 10-foot UI driven entirely by the remote.
// Menu.setApplicationMenu(null)

app.whenReady().then(() => {
  const win = new BrowserWindow({
    title: 'Vids',
    // Frameless: no OS title bar or borders. Window controls live in the
    // in-app header (see src/components/Header.tsx -> electron/preload.ts).
    // frame: false,
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

  // Serve cover images from disk for the `vid-cover` scheme. The absolute path
  // arrives in the `path` query param (URL-encoded by the scanner).
  protocol.handle('vid-cover', async (request) => {
    try {
      const filePath = new URL(request.url).searchParams.get('path')
      if (!filePath) return new Response(null, { status: 400 })
      const data = await fs.readFile(filePath)
      const type = COVER_MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
      return new Response(data, { headers: { 'content-type': type } })
    } catch {
      return new Response(null, { status: 404 })
    }
  })

  // You can use `process.env.VITE_DEV_SERVER_URL` when the vite command is called `serve`
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    // Load your file
    win.loadFile('dist/index.html')
  }

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

  // Scan one source for vids.json markers and return its media items. Any
  // failure (bad path, unreadable dir) collapses to an empty result.
  ipcMain.handle('library:scan', async (_event, source) => {
    try {
      return await scanSource(source)
    } catch {
      return []
    }
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
