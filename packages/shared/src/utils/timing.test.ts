import { describe, it, expect } from 'vitest'
import { getCurrentLineIndex, getLineProgress } from './timing.js'
import type { LyricsLine } from '../types/song.js'

const lines: LyricsLine[] = [
  { startMs: 1_000, endMs: 3_000, text: 'Line 1' },
  { startMs: 3_000, endMs: 6_000, text: 'Line 2' },
  { startMs: 6_000, endMs: 9_000, text: 'Line 3' },
]

describe('getCurrentLineIndex', () => {
  it('returns -1 before any line', () => {
    expect(getCurrentLineIndex(lines, 500)).toBe(-1)
  })

  it('returns 0 at the start of the first line', () => {
    expect(getCurrentLineIndex(lines, 1_000)).toBe(0)
  })

  it('returns correct index mid-song', () => {
    expect(getCurrentLineIndex(lines, 4_000)).toBe(1)
  })

  it('returns last index near end', () => {
    expect(getCurrentLineIndex(lines, 7_000)).toBe(2)
  })

  it('returns -1 for empty lines', () => {
    expect(getCurrentLineIndex([], 1_000)).toBe(-1)
  })

  it('returns -1 when past endMs', () => {
    expect(getCurrentLineIndex(lines, 9_500)).toBe(-1)
  })
})

describe('getLineProgress', () => {
  const line: LyricsLine = { startMs: 1_000, endMs: 3_000, text: 'X' }

  it('returns 0 at startMs', () => {
    expect(getLineProgress(line, 1_000)).toBe(0)
  })

  it('returns 1 at endMs', () => {
    expect(getLineProgress(line, 3_000)).toBe(1)
  })

  it('returns 0.5 at midpoint', () => {
    expect(getLineProgress(line, 2_000)).toBe(0.5)
  })
})
