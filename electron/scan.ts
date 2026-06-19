import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { hashVideoFile } from './hash'
import type { Source } from '../src/useSources'
import type { Group, LibraryItem, Video } from '../src/library'

// Scanning a source: walk it looking for `vids.json` marker files. A directory
// containing one is a movie or series; everything beneath it belongs to that
// item, so we stop descending once a marker is found. Video files under the
// marker are matched against the optional `group`/`video` regexes to derive
// season/episode names. See src/library.ts for the output shapes.

/** Recognised video file extensions (lower-case, leading dot). */
const VIDEO_EXTENSIONS = new Set([
  '.mkv',
  '.mp4',
  '.avi',
  '.mov',
  '.m4v',
  '.webm',
  '.ts',
  '.wmv',
  '.flv',
  '.mpg',
  '.mpeg',
])

/** The marker file that flags a directory as a movie or series. */
const MARKER = 'vids.json'

/** Schema of a vids.json file. `group`/`video` are RegExp source strings. */
type VidsConfig = {
  name: string
  type: 'series' | 'movie'
  group?: string
  video?: string
  /**
   * Path to the title's cover image, relative to this vids.json's directory
   * (e.g. "cover.jpg"). Ignored if it resolves outside the source root.
   */
  cover?: string
  poster?: string
}

/** Custom scheme served by the main process (electron/main.ts) for local files. */
const coverUrl = (absPath: string) =>
  `img://cover/?path=${encodeURIComponent(absPath)}`

const posterUrl = (absPath: string) =>
  `img://poster/?path=${encodeURIComponent(absPath)}`

/** One filesystem entry, normalised across providers. */
export type FsEntry = { name: string; isDirectory: boolean }

/**
 * Abstracts the filesystem so the scan algorithm is written once and reused for
 * every source type. `LocalProvider` backs `local` sources today; a future
 * `SshProvider` (over sftp) implements these same methods and the scanner works
 * unchanged. Paths passed around are provider-native absolute paths; `relPath`
 * turns one into the forward-slash path relative to the source root that the
 * group/video regexes match against (e.g. "/Sherlock/Season 1/a.mkv").
 */
export interface FsProvider {
  /** List the immediate children of a directory. */
  list(dir: string): Promise<FsEntry[]>
  /** Read a file as UTF-8 text. */
  readFile(file: string): Promise<string>
  /** Join a directory and child name into an absolute path. */
  join(dir: string, name: string): string
  /** Path of `full` relative to `root`, leading-slash and forward-slashed. */
  relPath(root: string, full: string): string
  /**
   * Resolve `rel` against `dir`, returning the absolute path only if it stays
   * within `root`; otherwise null (used to drop covers that escape the source).
   */
  resolveWithin(root: string, dir: string, rel: string): string | null
  /**
   * Fast identity hash of a video file (file size + head + tail), used to key
   * its watch progress. Returns undefined when the file can't be hashed. A
   * future SshProvider implements this over SFTP with the same chunked reads, so
   * remote files stay just as cheap to identify (see electron/hash.ts).
   */
  hash(file: string): Promise<string | undefined>
}

/** Local-disk implementation of FsProvider. */
class LocalProvider implements FsProvider {
  async list(dir: string): Promise<FsEntry[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
    }))
  }
  readFile(file: string): Promise<string> {
    return fs.readFile(file, 'utf-8')
  }
  join(dir: string, name: string): string {
    return path.join(dir, name)
  }
  relPath(root: string, full: string): string {
    return '/' + path.relative(root, full).split(path.sep).join('/')
  }
  resolveWithin(root: string, dir: string, rel: string): string | null {
    const abs = path.resolve(dir, rel)
    const relToRoot = path.relative(root, abs)
    // Empty -> the root itself; '..'-prefixed or absolute -> escaped the root.
    if (!relToRoot || relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) {
      return null
    }
    return abs
  }
  hash(file: string): Promise<string | undefined> {
    return hashVideoFile(file)
  }
}

/**
 * Hash many files concurrently (bounded, so a large library doesn't open every
 * file at once) into a `path -> hash` map. Files that fail to hash are simply
 * absent from the map.
 */
async function hashVideos(
  provider: FsProvider,
  files: string[],
): Promise<Map<string, string>> {
  const hashes = new Map<string, string>()
  let next = 0
  const worker = async () => {
    while (next < files.length) {
      const file = files[next++]
      const hash = await provider.hash(file)
      if (hash) hashes.set(file, hash)
    }
  }
  const workers = Array.from({ length: Math.min(8, files.length) }, worker)
  await Promise.all(workers)
  return hashes
}

const isVideo = (name: string) =>
  VIDEO_EXTENSIONS.has(path.extname(name).toLowerCase())

/** A file's name without its extension. */
const baseName = (file: string) => path.basename(file, path.extname(file))

/** A short, stable, URL-safe id for an item, derived from its directory path. */
const itemId = (dir: string) =>
  createHash('sha1').update(dir).digest('base64url').slice(0, 12)

/** Natural-ish sort by `name` so "Season 2" precedes "Season 10". */
const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { numeric: true })

/** Compile a RegExp source string; an invalid pattern is treated as no regex. */
function compile(source: string | undefined): RegExp | null {
  if (!source) return null
  try {
    return new RegExp(source)
  } catch {
    return null
  }
}

/** Collect the absolute paths of every video file beneath `dir`. */
async function collectVideos(
  provider: FsProvider,
  dir: string,
): Promise<string[]> {
  const found: string[] = []
  const walk = async (current: string): Promise<void> => {
    let entries: FsEntry[]
    try {
      entries = await provider.list(current)
    } catch {
      return
    }
    await Promise.all(
      entries.map((entry) => {
        const full = provider.join(current, entry.name)
        if (entry.isDirectory) return walk(full)
        if (isVideo(entry.name)) found.push(full)
        return undefined
      }),
    )
  }
  await walk(dir)
  return found
}

/** Build one library item from a directory that holds a vids.json. */
async function buildItem(
  provider: FsProvider,
  root: string,
  dir: string,
  config: VidsConfig,
): Promise<LibraryItem> {
  const groupRe = compile(config.group)
  const videoRe = compile(config.video)
  const files = await collectVideos(provider, dir)
  const hashes = await hashVideos(provider, files)

  // Cover: resolved relative to this item's directory; dropped if it escapes
  // the source root. A missing file still yields a URL — the card falls back
  // when the image fails to load.
  const coverPath = config.cover
    ? provider.resolveWithin(root, dir, config.cover)
    : null
  const cover = coverPath ? coverUrl(coverPath) : undefined
  const posterPath = config.poster
    ? provider.resolveWithin(root, dir, config.poster)
    : null
  const poster = posterPath ? posterUrl(posterPath) : undefined

  // Derive each video's display name (and group, for series) from its path
  // relative to the source root — the same path shape the user's regexes target.
  const entries = files.map((full) => {
    const rel = provider.relPath(root, full)
    const name = (videoRe ? rel.match(videoRe)?.[1] : undefined) ?? baseName(full)
    const group = groupRe ? rel.match(groupRe)?.[1] : undefined
    const video: Video = { name, path: full, hash: hashes.get(full) }
    return { group, video }
  })

  if (config.type === 'movie') {
    return {
      id: itemId(dir),
      type: 'movie',
      name: config.name,
      cover,
      poster,
      path: dir,
      videos: entries.map((entry) => entry.video).sort(byName),
    }
  }

  // Series: bucket videos by their captured group name (falling back to the
  // show name when a file doesn't match the group regex).
  const buckets = new Map<string, Video[]>()
  for (const entry of entries) {
    const key = entry.group ?? config.name
    const bucket = buckets.get(key)
    if (bucket) bucket.push(entry.video)
    else buckets.set(key, [entry.video])
  }
  const groups: Group[] = [...buckets.entries()]
    .map(([name, videos]) => ({ name, videos: videos.sort(byName) }))
    .sort(byName)
  return {
    id: itemId(dir),
    type: 'series',
    name: config.name,
    cover,
    poster,
    path: dir,
    groups,
  }
}

/**
 * Walk a source root, find every vids.json marker, and return the media items
 * they describe. Sibling directories are walked in parallel; descent stops at
 * each marker.
 */
export async function scanProvider(
  provider: FsProvider,
  root: string,
): Promise<LibraryItem[]> {
  const items: LibraryItem[] = []
  const walk = async (dir: string): Promise<void> => {
    let entries: FsEntry[]
    try {
      entries = await provider.list(dir)
    } catch {
      return
    }
    if (entries.some((entry) => !entry.isDirectory && entry.name === MARKER)) {
      try {
        const raw = await provider.readFile(provider.join(dir, MARKER))
        items.push(await buildItem(provider, root, dir, JSON.parse(raw)))
      } catch {
        // Missing/malformed vids.json -> skip this directory.
      }
      return
    }
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory)
        .map((entry) => walk(provider.join(dir, entry.name))),
    )
  }
  await walk(root)
  return items.sort(byName)
}

/** Expand a leading `~` to the user's home directory. */
function expandTilde(p: string): string {
  if (p === '~') return os.homedir()
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2))
  return p
}

/**
 * Entry point: pick the provider for a source and scan it. New source types are
 * added here by mapping them to an FsProvider implementation.
 */
export async function scanSource(source: Source): Promise<LibraryItem[]> {
  switch (source.type) {
    case 'local':
      return scanProvider(new LocalProvider(), expandTilde(source.path))
    case 'ssh':
      // Not wired up yet: add an SshProvider and scan it here.
      return []
    default:
      return []
  }
}
