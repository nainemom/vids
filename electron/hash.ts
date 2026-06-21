import { createHash } from 'node:crypto'
import { open, stat } from 'node:fs/promises'

// We identify a video by a *partial* MD5 rather than hashing every byte: the file
// size plus its first and last 64 KiB. Hashing a multi-GB movie end-to-end is far
// too slow — and over SFTP it would mean streaming the whole file across the
// network just to derive an id. Three tiny reads are effectively instant yet still
// pin the file's identity (size + head + tail all change whenever the file does),
// which is all we need to key its watch progress. This is the same trick media
// players use for fast file matching.
const CHUNK = 64 * 1024

/** A handle whose read fills `buf[off..off+len)` from `pos`, reporting bytesRead. */
type ReadableHandle = {
  read: (
    buf: Buffer,
    off: number,
    len: number,
    pos: number,
  ) => Promise<{ bytesRead: number }>
}

/**
 * Read exactly `length` bytes at `position` into a fresh buffer, looping over
 * short reads. A single `read()` is NOT guaranteed to return the whole range —
 * on a local disk it usually does, but FUSE/sshfs (and any network filesystem)
 * routinely hands back fewer bytes per call. The old code read once into an
 * `allocUnsafe` buffer and hashed the *whole* buffer regardless of how much was
 * actually read, so a short read folded uninitialised memory into the digest —
 * giving an unstable hash over sshfs (the same file hashing differently between
 * scans, so saved watch-progress stopped matching). We zero-fill, loop until the
 * range is filled (or EOF), and hash only the bytes we really read.
 */
async function readChunk(
  handle: ReadableHandle,
  length: number,
  position: number,
): Promise<Buffer> {
  const buf = Buffer.alloc(length)
  let got = 0
  while (got < length) {
    const { bytesRead } = await handle.read(buf, got, length - got, position + got)
    if (bytesRead <= 0) break // EOF or no more data available
    got += bytesRead
  }
  return got === length ? buf : buf.subarray(0, got)
}

/**
 * Compute the partial-MD5 identity hash of a video file, given an opened handle
 * and its size. Split out so providers that already have an open handle (e.g. a
 * future SFTP provider) can reuse the exact same algorithm — keeping local and
 * remote hashes identical for the same bytes.
 */
export async function hashFromHandle(
  handle: ReadableHandle,
  size: number,
): Promise<string> {
  const md5 = createHash('md5')
  // Fold in the size first so two files that happen to share head+tail bytes
  // (padded containers, say) still hash differently.
  md5.update(`${size}:`)

  const headLen = Math.min(CHUNK, size)
  if (headLen > 0) {
    md5.update(await readChunk(handle, headLen, 0))
  }

  // Only read a distinct tail when the file is larger than one chunk; otherwise
  // the head already covered the whole file.
  if (size > CHUNK) {
    const tailLen = Math.min(CHUNK, size - headLen)
    md5.update(await readChunk(handle, tailLen, size - tailLen))
  }

  return md5.digest('hex')
}

/**
 * Partial-MD5 identity hash of a local video file. Returns a hex digest, or
 * undefined if the file can't be read — callers simply skip progress tracking
 * for a file that won't hash.
 */
export async function hashVideoFile(filePath: string): Promise<string | undefined> {
  let handle
  try {
    const { size } = await stat(filePath)
    handle = await open(filePath, 'r')
    return await hashFromHandle(handle, size)
  } catch {
    return undefined
  } finally {
    await handle?.close()
  }
}
