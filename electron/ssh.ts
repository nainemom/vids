import { spawn, type ChildProcess } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { createHash } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import type { SshSource, SshTestResult } from '../src/useSources'

// An SSH source is exposed to the rest of the app as an ordinary local folder by
// mounting its remote directory with sshfs (FUSE over SFTP). Once mounted, the
// scanner, cover/poster reads, identity hashing and mpv playback all run against
// real local paths — there's no bespoke remote-shell or sftp:// code path, and
// mpv opens a plain file (no libssh dependency).
//
// Auth, host trust and known_hosts stay the system OpenSSH client's job (sshfs
// shells out to `ssh`): the first connection is trusted in a real terminal
// (openTerminalSsh, which answers OpenSSH's own yes/no prompt and writes
// known_hosts), and every mount runs with StrictHostKeyChecking=yes so it fails
// fast on an unknown/changed host instead of hanging on a prompt.

type Capture = { code: number | null; stdout: string; stderr: string }

/** Spawn a command, capturing stdout/stderr as text. Never rejects. */
function capture(cmd: string, args: string[]): Promise<Capture> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d.toString()))
    child.stderr.on('data', (d) => (stderr += d.toString()))
    // ENOENT (binary not installed) lands here, not on 'close'.
    child.on('error', (e) => resolve({ code: 255, stdout, stderr: stderr || String(e) }))
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

/** Whether a binary exists on PATH. Resolves true if it ran at all (any exit
 * code), false only when it isn't found. Cached per binary. */
const binaryProbes = new Map<string, Promise<boolean>>()
function hasBinary(bin: string): Promise<boolean> {
  let probe = binaryProbes.get(bin)
  if (!probe) {
    probe = new Promise<boolean>((resolve) => {
      const child: ChildProcess = spawn(bin, ['--version'], { stdio: 'ignore' })
      child.on('error', () => resolve(false)) // ENOENT -> not installed
      child.on('close', () => resolve(true))
    })
    binaryProbes.set(bin, probe)
  }
  return probe
}

/** Whether `sshfs` is installed (SSH sources can't be mounted without it). */
export const hasSshfs = () => hasBinary('sshfs')

/** The fusermount binary to unmount with — FUSE3's `fusermount3` if present. */
let unmountBinChoice: Promise<string> | null = null
function fusermountBin(): Promise<string> {
  if (!unmountBinChoice) {
    unmountBinChoice = (async () =>
      (await hasBinary('fusermount3')) ? 'fusermount3' : 'fusermount')()
  }
  return unmountBinChoice
}

// Mountpoints live under one root in the temp dir. Each is keyed on the
// connection target (user/host/port/path), so the add-source form's throwaway
// drafts and the saved source resolve to the same mountpoint, and two different
// remote paths never collide on one mountpoint.
const MOUNT_ROOT = path.join(os.tmpdir(), 'vids-mounts')

/** The mountpoint a source's remote folder is (or would be) mounted at. */
export function mountpointFor(source: SshSource): string {
  const key = `${source.user}@${source.host}:${source.port || 22}:${source.path || ''}`
  const id = createHash('sha1').update(key).digest('hex').slice(0, 16)
  return path.join(MOUNT_ROOT, id)
}

/** The `user@host:path` sshfs source spec (an empty path -> the login home). */
const remoteSpec = (s: SshSource) => `${s.user}@${s.host}:${s.path || ''}`

const target = (s: SshSource) => `${s.user}@${s.host}`

/** Unescape the octal sequences (\040 space, \011 tab, …) used in /proc/mounts. */
const unescapeMount = (s: string) =>
  s.replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))

/** The device (`user@host:path`) mounted at `mountpoint`, or null if none is. */
async function mountedDevice(mountpoint: string): Promise<string | null> {
  let raw: string
  try {
    raw = await fs.readFile('/proc/mounts', 'utf-8')
  } catch {
    return null // no procfs (non-Linux): treat as not-mounted
  }
  for (const line of raw.split('\n')) {
    const [dev, mp] = line.split(' ')
    if (mp && unescapeMount(mp) === mountpoint) return unescapeMount(dev)
  }
  return null
}

const isMounted = async (mountpoint: string) =>
  (await mountedDevice(mountpoint)) !== null

// Mountpoints we've established this session, torn down on quit (unmountAll).
const activeMounts = new Set<string>()

/** Raised when a mount fails; carries sshfs's stderr for classification. */
export class MountError extends Error {}

/**
 * Run sshfs to mount `source` at `mountpoint`. Resolves on the foreground
 * process's exit — sshfs daemonises after the mount succeeds, and the
 * backgrounded daemon can hold the stderr pipe open, so waiting for 'close'
 * (stdio drained) could stall; 'exit' (process ended) is what we want.
 */
function runSshfs(source: SshSource, mountpoint: string): Promise<Capture> {
  const args = [
    remoteSpec(source),
    mountpoint,
    '-p', String(source.port || 22),
    '-o', 'StrictHostKeyChecking=yes',
    '-o', 'ConnectTimeout=10',
    '-o', 'reconnect',
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=3',
    '-o', 'ro', // a media library is only ever read
  ]
  // Password auth feeds the password on stdin (password_stdin — no sshpass
  // needed); key/agent auth runs in BatchMode so a missing key fails fast
  // instead of prompting on a tty that isn't there.
  if (source.password) args.push('-o', 'password_stdin')
  else args.push('-o', 'BatchMode=yes')

  return new Promise((resolve) => {
    const child: ChildProcess = spawn('sshfs', args, {
      stdio: [source.password ? 'pipe' : 'ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    child.stderr?.on('data', (d) => (stderr += d.toString()))
    child.on('error', (e) => resolve({ code: 255, stdout: '', stderr: stderr || String(e) }))
    child.on('exit', (code) => resolve({ code: code ?? 255, stdout: '', stderr }))
    if (source.password) {
      child.stdin?.write(source.password + '\n')
      child.stdin?.end()
    }
  })
}

/**
 * Ensure `source`'s remote folder is mounted, returning the mountpoint. Reuses
 * an existing mount for the same target (mounts persist for the session and
 * across runs). Throws MountError — with sshfs's stderr — on failure.
 */
export async function ensureMounted(source: SshSource): Promise<string> {
  const mountpoint = mountpointFor(source)
  if (await isMounted(mountpoint)) {
    activeMounts.add(mountpoint)
    return mountpoint
  }
  if (!(await hasSshfs())) throw new MountError('sshfs-not-found')

  await fs.mkdir(mountpoint, { recursive: true })
  const r = await runSshfs(source, mountpoint)
  if (r.code !== 0 || !(await isMounted(mountpoint))) {
    await fs.rmdir(mountpoint).catch(() => {}) // remove the empty dir we just made
    throw new MountError(r.stderr.trim() || `sshfs exited with code ${r.code}`)
  }
  activeMounts.add(mountpoint)
  return mountpoint
}

/** Unmount a single mountpoint (best-effort) and drop its now-empty dir. */
export async function unmount(mountpoint: string): Promise<void> {
  const bin = await fusermountBin()
  const r = await capture(bin, ['-u', mountpoint])
  // A busy mount (e.g. mpv still reading) won't detach with a plain unmount;
  // fall back to a lazy one so it goes away once the last user lets go.
  if (r.code !== 0 && (await isMounted(mountpoint))) {
    await capture(bin, ['-u', '-z', mountpoint]).catch(() => {})
  }
  activeMounts.delete(mountpoint)
  await fs.rmdir(mountpoint).catch(() => {})
}

/** Unmount everything we mounted this session (called on app quit). */
export async function unmountAll(): Promise<void> {
  await Promise.all([...activeMounts].map((mp) => unmount(mp)))
}

/** Whether the host already has an entry in known_hosts (i.e. has been trusted). */
export async function isHostKnown(host: string, port = 22): Promise<boolean> {
  const name = port && port !== 22 ? `[${host}]:${port}` : host
  const r = await capture('ssh-keygen', ['-F', name])
  return r.code === 0 && r.stdout.trim().length > 0
}

/** Map an sshfs/ssh failure (its stderr) to a classified, user-facing result. */
function classifyMountFailure(err: string, source: SshSource): SshTestResult {
  if (err === 'sshfs-not-found') {
    return {
      ok: false,
      reason: 'no-sshfs',
      message: 'SSH sources need `sshfs`. Install it (e.g. `sudo apt install sshfs`) and try again.',
    }
  }
  if (/REMOTE HOST IDENTIFICATION HAS CHANGED/i.test(err)) {
    return {
      ok: false,
      reason: 'hostkey-changed',
      message: `${source.host}'s host key has changed. If you trust the server, remove its old key from ~/.ssh/known_hosts and reconnect in a terminal.`,
    }
  }
  if (/host key verification failed/i.test(err)) {
    return {
      ok: false,
      reason: 'untrusted',
      message: `${source.host} isn't trusted. Connect once in a terminal to verify and trust its key.`,
    }
  }
  if (/permission denied|authentication failed|too many authentication/i.test(err)) {
    return {
      ok: false,
      reason: 'auth',
      message: source.password
        ? 'Authentication failed — check the username and password.'
        : 'Authentication failed — no usable SSH key. Add a password, or set up key auth.',
    }
  }
  if (
    /connection refused|timed out|timeout|could not resolve|name or service not known|no route to host|network is unreachable|connection reset|connection closed/i.test(
      err,
    )
  ) {
    return {
      ok: false,
      reason: 'network',
      message: "Couldn't reach the server — check the host, port and network.",
    }
  }
  return { ok: false, reason: 'unknown', message: err || 'Connection failed.' }
}

/**
 * Probe an SSH source by mounting it and classify the outcome so the UI can
 * react: success, an untrusted host (-> offer to connect in a terminal), an
 * auth/network/path problem, a changed host key, or a missing sshfs. Never runs
 * against an untrusted host, so it can't hang on a trust prompt. A path-less
 * draft is tested by mounting the login home (then unmounting it), so the
 * connection can be checked before the remote folder has been filled in.
 */
export async function testConnection(source: SshSource): Promise<SshTestResult> {
  if (!source.host || !source.user) {
    return { ok: false, reason: 'unknown', message: 'Host and user are required.' }
  }
  if (!(await hasSshfs())) {
    return {
      ok: false,
      reason: 'no-sshfs',
      message: 'SSH sources need `sshfs`. Install it (e.g. `sudo apt install sshfs`) and try again.',
    }
  }
  if (!(await isHostKnown(source.host, source.port))) {
    return {
      ok: false,
      reason: 'untrusted',
      message: `${source.host} hasn't been trusted yet. Connect once in a terminal to verify and trust its key.`,
    }
  }

  let mountpoint: string
  try {
    mountpoint = await ensureMounted(source)
  } catch (e) {
    return classifyMountFailure(String((e as Error)?.message ?? e), source)
  }

  try {
    await fs.readdir(mountpoint) // confirm the mounted folder is actually readable
    return {
      ok: true,
      message: source.path
        ? `Connected — ${source.path} is mounted.`
        : 'Connected — login works. Add the path to finish.',
    }
  } catch {
    return {
      ok: false,
      reason: 'path',
      message: `Connected, but ${source.path || 'the home folder'} can't be read on the server.`,
    }
  } finally {
    // A path-less test only proves login; don't leave the home folder mounted.
    if (!source.path) await unmount(mountpoint)
  }
}

/**
 * Open the user's terminal emulator running a plain interactive `ssh` to the
 * host, so the *native* client handles first-time trust (the yes/no prompt that
 * writes known_hosts), password entry and any keyboard-interactive/2FA. The
 * window is left open after the session ends so the user can read the outcome.
 * Returns which terminal launched, or an error if none could be found.
 */
export async function openTerminalSsh(
  source: SshSource,
): Promise<{ ok: boolean; message?: string }> {
  if (!source.host || !source.user) {
    return { ok: false, message: 'Host and user are required.' }
  }
  const port = source.port || 22
  // StrictHostKeyChecking=ask (the default) is what surfaces the trust prompt.
  const ssh = `ssh -o StrictHostKeyChecking=ask -p ${port} ${target(source)}`
  const inner = `${ssh}; echo; printf 'Session ended — press Enter to close.'; read _`

  if (process.platform === 'darwin') {
    // Run the ssh line in Terminal.app via AppleScript.
    const script = `tell application "Terminal" to do script ${JSON.stringify(ssh)}\ntell application "Terminal" to activate`
    const r = await capture('osascript', ['-e', script])
    return r.code === 0
      ? { ok: true, message: 'Terminal' }
      : { ok: false, message: r.stderr.trim() || 'Could not open Terminal.' }
  }

  if (process.platform === 'win32') {
    const ok = await trySpawn('cmd', ['/c', 'start', '', 'cmd', '/k', ssh])
    return ok ? { ok: true, message: 'cmd' } : { ok: false, message: 'Could not open a terminal.' }
  }

  // Linux/other: try common emulators. x-terminal-emulator is Debian's generic
  // alias; the rest cover the popular ones. Most take `-e CMD ARGS`; the GTK
  // terminals want `--`/`-x` before the command instead.
  const candidates: [string, string[]][] = [
    ['x-terminal-emulator', ['-e', 'sh', '-c', inner]],
    ['konsole', ['-e', 'sh', '-c', inner]],
    ['gnome-terminal', ['--', 'sh', '-c', inner]],
    ['xfce4-terminal', ['-x', 'sh', '-c', inner]],
    ['kitty', ['sh', '-c', inner]],
    ['alacritty', ['-e', 'sh', '-c', inner]],
    ['xterm', ['-e', 'sh', '-c', inner]],
  ]
  for (const [bin, args] of candidates) {
    if (await trySpawn(bin, args)) return { ok: true, message: bin }
  }
  return {
    ok: false,
    message: 'No terminal emulator found. Install one (e.g. xterm), or run `ssh ' + target(source) + '` manually once.',
  }
}

/**
 * Spawn a detached GUI process and resolve whether it actually started (the
 * binary exists and didn't immediately error). Used to pick the first available
 * terminal emulator.
 */
function trySpawn(bin: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const done = (ok: boolean) => {
      if (settled) return
      settled = true
      resolve(ok)
    }
    try {
      const child = spawn(bin, args, { detached: true, stdio: 'ignore' })
      child.on('error', () => done(false))
      child.on('spawn', () => {
        child.unref()
        done(true)
      })
      // Fallback in case neither event fires promptly.
      setTimeout(() => done(true), 400)
    } catch {
      done(false)
    }
  })
}
