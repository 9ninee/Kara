import type { LyricsLine } from '../types/song.js'

const TIMESTAMP_RE = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g

function parseTimestamp(min: string, sec: string, cs: string): number {
  const ms = cs.length === 2 ? parseInt(cs, 10) * 10 : parseInt(cs, 10)
  return parseInt(min, 10) * 60_000 + parseInt(sec, 10) * 1_000 + ms
}

/**
 * Parse an LRC file string into an array of LyricsLine sorted by startMs.
 * Supports multiple timestamps per line (e.g. [00:10.00][01:30.00]text).
 */
export function parseLRC(content: string): LyricsLine[] {
  const lines: Array<{ timeMs: number; text: string }> = []

  for (const raw of content.split('\n')) {
    const trimmed = raw.trim()
    if (!trimmed) continue

    const timestamps: number[] = []
    let match: RegExpExecArray | null
    let lastIndex = 0

    TIMESTAMP_RE.lastIndex = 0
    while ((match = TIMESTAMP_RE.exec(trimmed)) !== null) {
      timestamps.push(parseTimestamp(match[1], match[2], match[3]))
      lastIndex = TIMESTAMP_RE.lastIndex
    }

    if (timestamps.length === 0) continue

    const text = trimmed.slice(lastIndex).trim()
    for (const timeMs of timestamps) {
      lines.push({ timeMs, text })
    }
  }

  lines.sort((a, b) => a.timeMs - b.timeMs)

  return lines.map((line, i) => ({
    startMs: line.timeMs,
    endMs: lines[i + 1]?.timeMs ?? line.timeMs + 5_000,
    text: line.text,
  }))
}
