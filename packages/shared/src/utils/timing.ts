import type { LyricsLine } from '../types/song.js'

/**
 * Binary search for the current lyrics line given playback position.
 * Returns -1 if before the first line.
 */
export function getCurrentLineIndex(lines: LyricsLine[], positionMs: number): number {
  if (lines.length === 0) return -1
  let lo = 0
  let hi = lines.length - 1
  let result = -1

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    if (lines[mid].startMs <= positionMs) {
      result = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  if (result === -1) return -1
  if (positionMs > lines[result].endMs) return -1
  return result
}

/** Returns the fraction [0, 1] through the current line */
export function getLineProgress(line: LyricsLine, positionMs: number): number {
  if (positionMs <= line.startMs) return 0
  if (positionMs >= line.endMs) return 1
  return (positionMs - line.startMs) / (line.endMs - line.startMs)
}
