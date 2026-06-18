import { app, BrowserWindow, ipcMain, protocol } from 'electron'
import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { scanSource } from './scan'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Sources are persisted as JSON under the user's config directory.
const CONFIG_DIR = path.join(os.homedir(), '.config', 'vids')
const SOURCES_FILE = path.join(CONFIG_DIR, 'sources.json')
const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json')

// mpv loads this Lua script on launch (see the video:play handler). It quits mpv
// when its window loses focus OR the user leaves fullscreen (e.g. Esc / `f`) —
// but each only after that state has been entered once, so it can't self-close
// before the fullscreen window has even appeared.
const QUIT_GUARD_SCRIPT = path.join(CONFIG_DIR, 'quit-guard.lua')
const QUIT_GUARD_LUA = `local had_focus = false
local was_fullscreen = false
mp.observe_property("focused", "bool", function(_, value)
  if value == true then
    had_focus = true
  elseif value == false and had_focus then
    mp.command("quit")
  end
end)
mp.observe_property("fullscreen", "bool", function(_, value)
  if value == true then
    was_fullscreen = true
  elseif value == false and was_fullscreen then
    mp.command("quit")
  end
end)
`

// Playback settings, with their defaults. `subtitleColor` is a UI token mapped
// to a concrete mpv color in SUB_COLORS.
const DEFAULT_SETTINGS = {
  subtitleSize: 50,
  subtitleColor: 'white' as 'white' | 'yellow',
}

// UI colour token -> mpv `--sub-color` value.
const SUB_COLORS: Record<string, string> = {
  white: '#FFFFFF',
  yellow: '#FFFF00',
}

/** Read the persisted settings, merged over the defaults. */
async function readSettings() {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, 'utf-8')
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

/**
 * Resolve a scanned video path into something mpv can open. Local paths are used
 * as-is; a path that lives under an SSH source is wrapped as an `sftp://` URL so
 * mpv streams it over SFTP.
 */
function resolvePlayPath(videoPath: string, sources: unknown): string {
  const list = Array.isArray(sources) ? sources : []
  for (const s of list) {
    if (
      s?.type === 'ssh' &&
      typeof s.path === 'string' &&
      videoPath.startsWith(s.path)
    ) {
      const port = s.port || 22
      const auth = s.password ? `${s.user}:${s.password}` : s.user
      return `sftp://${auth}@${s.host}:${port}${videoPath}`
    }
  }
  return videoPath
}

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

  // Read settings from disk, merged over the defaults.
  ipcMain.handle('settings:read', () => readSettings())

  // Write settings to disk
  ipcMain.handle('settings:write', async (_event, settings) => {
    await fs.mkdir(CONFIG_DIR, { recursive: true })
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8')
  })

  // Play a video in a separate, fullscreen mpv window. mpv runs on its own (no
  // IPC/controls); the bundled Lua script quits mpv as soon as its window loses
  // focus or leaves fullscreen, so switching away (or pressing Esc/`f`) closes it.
  ipcMain.handle('video:play', async (_event, videoPath: string, sources) => {
    const settings = await readSettings()
    await fs.mkdir(CONFIG_DIR, { recursive: true })
    await fs.writeFile(QUIT_GUARD_SCRIPT, QUIT_GUARD_LUA, 'utf-8')

    const args = [
      '--fullscreen',
      '--force-window=yes',
      `--script=${QUIT_GUARD_SCRIPT}`,
      `--sub-font-size=${settings.subtitleSize}`,
      `--sub-color=${SUB_COLORS[settings.subtitleColor] ?? SUB_COLORS.white}`,
      resolvePlayPath(videoPath, sources),
    ]

    // Detached + unref so the IPC call returns immediately and mpv runs on its
    // own; ignore spawn errors (e.g. mpv not installed) rather than crash.
    const child = spawn('mpv', args, { detached: true, stdio: 'ignore' })
    child.on('error', (err: Error) => console.error('Failed to launch mpv:', err))
    child.unref()
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
