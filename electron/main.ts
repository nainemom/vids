import { app, BrowserWindow, ipcMain, protocol } from 'electron'
import { fileURLToPath } from 'node:url'
import { promises as fs, watch } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { scanSource } from './scan'
import { ensureMounted, mountpointFor, openTerminalSsh, testConnection, unmountAll } from './ssh'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Sources are persisted as JSON under the user's config directory.
const CONFIG_DIR = path.join(os.homedir(), '.config', 'vids')
const SOURCES_FILE = path.join(CONFIG_DIR, 'sources.json')
const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json')
// Watch progress, keyed by each video's identity hash: { "<hash>": <percent> }.
// mpv writes this from the progress-tracker Lua script below; the renderer reads
// it to draw progress bars / resume badges.
const PROGRESS_FILE = path.join(CONFIG_DIR, 'progress.json')

// mpv loads this Lua script on launch (see the video:play handler). It quits mpv
// when its window loses focus OR the user leaves fullscreen (e.g. `f`), and binds
// the back-style keys (Esc / Backspace / mouse-back) directly to quit so the same
// buttons that go "back" in the app also close the player. The focus/fullscreen
// guards each only fire after that state has been entered once, so mpv can't
// self-close before its fullscreen window has even appeared.
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

-- Back/close keys -> quit. Forced bindings override mpv's defaults (Esc would
-- otherwise just leave fullscreen, Backspace reset the speed). These are the
-- same keys the in-app detail pages treat as "back".
local function quit() mp.command("quit") end
mp.add_forced_key_binding("ESC", "vids-quit-esc", quit)
mp.add_forced_key_binding("BS", "vids-quit-bs", quit)
mp.add_forced_key_binding("MBTN_BACK", "vids-quit-back", quit)

-- Media-key bindings, forced so playback control works regardless of the user's
-- mpv config. Stop closes the player (same as Back). Next/Prev are intentionally
-- left unbound. Enter toggles play/pause.
mp.add_forced_key_binding("PLAYPAUSE", "vids-playpause", function() mp.command("cycle pause") end)
mp.add_forced_key_binding("PLAY", "vids-play", function() mp.set_property_bool("pause", false) end)
mp.add_forced_key_binding("PAUSE", "vids-pause", function() mp.set_property_bool("pause", true) end)
mp.add_forced_key_binding("STOP", "vids-stop", quit)
mp.add_forced_key_binding("FORWARD", "vids-forward", function() mp.command("seek 10") end)
mp.add_forced_key_binding("REWIND", "vids-rewind", function() mp.command("seek -10") end)
mp.add_forced_key_binding("ENTER", "vids-enter-playpause", function() mp.command("cycle pause") end)
mp.add_forced_key_binding("KP_ENTER", "vids-kpenter-playpause", function() mp.command("cycle pause") end)
`

// mpv also loads this script when a video is played with a known identity hash
// (see the video:play handler). mpv runs detached with no IPC, so this is how the
// app learns how far playback reached: the script periodically merges the current
// `percent-pos` into progress.json, keyed by the hash passed via --script-opts
// (vids_hash / vids_progress). It writes on a timer, on pause, and on shutdown so
// the last position survives the window closing.
const PROGRESS_SCRIPT = path.join(CONFIG_DIR, 'progress-tracker.lua')
const PROGRESS_LUA = `local utils = require "mp.utils"

local sopts = mp.get_property_native("script-opts") or {}
local hash = sopts.vids_hash
local progress_file = sopts.vids_progress

-- Nothing to record without an identity hash or a destination file.
if not hash or hash == "" or not progress_file or progress_file == "" then
  return
end

-- mpv clears percent-pos by the time end-file/shutdown fire (and the app quits
-- mpv on focus loss, which goes straight to shutdown), so we can't read it at
-- teardown. Instead track the latest observed value and persist *that*.
local last_percent = nil
mp.observe_property("percent-pos", "number", function(_, value)
  if value ~= nil then last_percent = value end
end)

local function save()
  if last_percent == nil then return end

  -- Read-modify-write the shared map so other titles' progress is preserved.
  local data = {}
  local f = io.open(progress_file, "r")
  if f then
    local content = f:read("*a")
    f:close()
    if content and content ~= "" then
      local parsed = utils.parse_json(content)
      if type(parsed) == "table" then data = parsed end
    end
  end

  data[hash] = last_percent

  local out = io.open(progress_file, "w")
  if out then
    out:write(utils.format_json(data))
    out:close()
  end
end

-- Persist periodically while playing, and again whenever playback stops (pause,
-- file end, or the window closing) so the last position is never lost.
mp.add_periodic_timer(5, save)
mp.observe_property("pause", "bool", function(_, paused)
  if paused then save() end
end)
mp.register_event("end-file", save)
mp.register_event("shutdown", save)
`

// App settings, with their defaults. `subtitleColor` is a UI token mapped to a
// concrete mpv color in SUB_COLORS. `startFullscreen` controls whether the main
// window opens fullscreen or windowed (applied at window creation below).
const DEFAULT_SETTINGS = {
  subtitleSize: 50,
  subtitleColor: 'white' as 'white' | 'yellow',
  startFullscreen: false,
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

/** Read the persisted sources; [] if the file is missing/invalid. */
async function readSources(): Promise<unknown[]> {
  try {
    const raw = await fs.readFile(SOURCES_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Read the watch-progress map ({ hash: percent }); {} if missing/invalid. */
async function readProgress(): Promise<Record<string, number>> {
  try {
    const raw = await fs.readFile(PROGRESS_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * Resolve a scanned video path into something mpv can open. Every path is a real
 * local path — SSH sources are sshfs mounts (see electron/ssh.ts). When the path
 * lives under an SSH source's mountpoint we make sure that mount is live first
 * (it may need re-establishing after a restart) and then hand mpv the local path.
 */
async function resolvePlayPath(videoPath: string, sources: unknown): Promise<string> {
  const list = Array.isArray(sources) ? sources : []
  for (const s of list) {
    if (s?.type === 'ssh') {
      const mountpoint = mountpointFor(s)
      if (videoPath === mountpoint || videoPath.startsWith(mountpoint + path.sep)) {
        await ensureMounted(s).catch(() => {})
        break
      }
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

// Lets the renderer load local cover images via `img://cover/?path=<abs>`
// from both the dev server (http) and the packaged app (file://). Must be
// declared before `app.whenReady`. The path is produced by the scanner, which
// has already confirmed it lives inside a source root (see electron/scan.ts).
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'img',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
])

// No application menu — this is a 10-foot UI driven entirely by the remote.
// Menu.setApplicationMenu(null)

// Tear down any sshfs mounts when the app exits (best-effort). Mounts are keyed
// by connection target and reused across runs, so this isn't required for
// correctness — it just avoids leaving live SSH mounts behind after quitting.
app.on('will-quit', () => {
  void unmountAll()
})

app.whenReady().then(async () => {
  // Read settings up front so the window can open in the user's chosen start
  // mode (fullscreen vs windowed) without a visible windowed -> fullscreen flash.
  const settings = await readSettings()

  const win = new BrowserWindow({
    title: 'Vids',
    // Frameless: no OS title bar or borders. Window controls live in the
    // in-app header (see src/components/Header.tsx -> electron/preload.ts).
    frame: false,
    autoHideMenuBar: true,
    // Open fullscreen or windowed per the persisted setting (Settings page).
    fullscreen: settings.startFullscreen,
    // Transparent so the rounded corners (applied in CSS to the app root)
    // reveal the desktop instead of black corners. Requires a compositor.
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      // Built alongside main.js in dist-electron (see vite.config.ts)
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Serve cover/poster images for the `img` scheme. The absolute path arrives in
  // the `path` query param (URL-encoded by the scanner) and is read from disk —
  // SSH covers live under an sshfs mountpoint, so they're local files too.
  protocol.handle('img', async (request) => {
    try {
      const params = new URL(request.url).searchParams
      const filePath = params.get('path')
      if (!filePath) return new Response(null, { status: 400 })

      const type = COVER_MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
      const data = await fs.readFile(filePath)
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
  ipcMain.handle('sources:read', () => readSources())

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

  // Probe an SSH source and classify the result (connected / untrusted / auth /
  // network / path / changed host key) so the add-source form can react.
  ipcMain.handle('ssh:test', async (_event, source) => {
    try {
      return await testConnection(source)
    } catch (err) {
      return { ok: false, reason: 'unknown', message: String((err as Error)?.message ?? err) }
    }
  })

  // Open a terminal running native `ssh` to the host so the user can trust it on
  // first connect (the yes/no prompt that writes known_hosts) and log in.
  ipcMain.handle('ssh:open-terminal', async (_event, source) => {
    try {
      return await openTerminalSsh(source)
    } catch (err) {
      return { ok: false, message: String((err as Error)?.message ?? err) }
    }
  })

  // Read settings from disk, merged over the defaults.
  ipcMain.handle('settings:read', () => readSettings())

  // Write settings to disk
  ipcMain.handle('settings:write', async (_event, settings) => {
    await fs.mkdir(CONFIG_DIR, { recursive: true })
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8')
  })

  // Read the current watch-progress map.
  ipcMain.handle('progress:read', () => readProgress())

  // Push live progress updates to the renderer. mpv (running detached) rewrites
  // progress.json as playback advances; watching the config dir lets the open UI
  // move its progress bars without a manual refresh. fs.watch can fire several
  // times per write, so the read is debounced. The watcher lives for the app's
  // lifetime, so it's never closed.
  fs.mkdir(CONFIG_DIR, { recursive: true })
    .then(() => {
      let timer: ReturnType<typeof setTimeout> | null = null
      watch(CONFIG_DIR, (_event, filename) => {
        if (filename !== 'progress.json') return
        if (timer) clearTimeout(timer)
        timer = setTimeout(async () => {
          if (!win.isDestroyed()) win.webContents.send('progress:changed', await readProgress())
        }, 150)
      })
    })
    .catch(() => {})

  // Play a video in a separate, fullscreen mpv window. mpv runs on its own (no
  // IPC/controls); the bundled Lua scripts quit mpv as soon as its window loses
  // focus or leaves fullscreen, and (when a `hash` is given) record watch
  // progress to progress.json as playback advances.
  ipcMain.handle('video:play', async (_event, videoPath: string, sources, hash?: string) => {
    const settings = await readSettings()
    await fs.mkdir(CONFIG_DIR, { recursive: true })
    await fs.writeFile(QUIT_GUARD_SCRIPT, QUIT_GUARD_LUA, 'utf-8')

    const args = [
      '--fullscreen',
      '--force-window=yes',
      `--script=${QUIT_GUARD_SCRIPT}`,
      `--sub-font-size=${settings.subtitleSize}`,
      `--sub-color=${SUB_COLORS[settings.subtitleColor] ?? SUB_COLORS.white}`,
    ]

    // Only track progress when we have a stable id for this file. The hash and
    // the destination file are passed to the tracker via --script-opts.
    if (hash) {
      await fs.writeFile(PROGRESS_SCRIPT, PROGRESS_LUA, 'utf-8')
      args.push(
        `--script=${PROGRESS_SCRIPT}`,
        `--script-opts=vids_hash=${hash},vids_progress=${PROGRESS_FILE}`,
      )

      // Auto-resume: if this file was left partway through (the same 1–95% band
      // the UI calls "in progress"), start mpv there. Outside that band — barely
      // started or basically finished — start from the beginning.
      const saved = (await readProgress())[hash]
      if (typeof saved === 'number' && saved >= 1 && saved < 95) {
        args.push(`--start=${saved}%`)
      }
    }

    args.push(await resolvePlayPath(videoPath, sources))

    // Detached + unref so the IPC call returns immediately and mpv runs on its
    // own; ignore spawn errors (e.g. mpv not installed) rather than crash.
    const child = spawn('mpv', args, { detached: true, stdio: 'ignore' })
    child.on('error', (err: Error) => console.error('Failed to launch mpv:', err))
    child.unref()
  })

  // Frameless window controls. The header's buttons fire these (preload uses
  // ipcRenderer.send, so they're plain listeners, not invoke handlers).
  ipcMain.on('app:close', () => win.close())
  ipcMain.on('app:toggle-fullscreen', () => win.setFullScreen(!win.isFullScreen()))

  // Fullscreen state -> renderer (used to drop rounded corners in fullscreen)
  ipcMain.handle('app:is-fullscreen', () => win.isFullScreen())
  win.on('enter-full-screen', () =>
    win.webContents.send('app:fullscreen-changed', true),
  )
  win.on('leave-full-screen', () =>
    win.webContents.send('app:fullscreen-changed', false),
  )
})
