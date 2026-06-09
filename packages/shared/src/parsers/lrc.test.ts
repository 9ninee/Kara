import { describe, it, expect } from 'vitest'
import { parseLRC } from './lrc.js'

describe('parseLRC', () => {
  it('parses a simple LRC file', () => {
    const lrc = `
[00:10.00]Hello world
[00:15.50]Second line
[00:20.00]Third line
`
    const lines = parseLRC(lrc)
    expect(lines).toHaveLength(3)
    expect(lines[0]).toMatchObject({ startMs: 10_000, text: 'Hello world' })
    expect(lines[1]).toMatchObject({ startMs: 15_500, text: 'Second line' })
    expect(lines[2]).toMatchObject({ startMs: 20_000, text: 'Third line' })
  })

  it('sets endMs to next line startMs', () => {
    const lrc = '[00:10.00]Line A\n[00:20.00]Line B\n'
    const lines = parseLRC(lrc)
    expect(lines[0].endMs).toBe(20_000)
  })

  it('sets endMs to startMs + 5s for last line', () => {
    const lrc = '[00:10.00]Only line\n'
    const lines = parseLRC(lrc)
    expect(lines[0].endMs).toBe(15_000)
  })

  it('handles multiple timestamps on one line', () => {
    const lrc = '[00:10.00][01:30.00]Chorus\n'
    const lines = parseLRC(lrc)
    expect(lines).toHaveLength(2)
    expect(lines[0].startMs).toBe(10_000)
    expect(lines[1].startMs).toBe(90_000)
    expect(lines[0].text).toBe('Chorus')
    expect(lines[1].text).toBe('Chorus')
  })

  it('ignores metadata tags', () => {
    const lrc = '[ti:Song Title]\n[ar:Artist]\n[00:05.00]Real line\n'
    const lines = parseLRC(lrc)
    expect(lines).toHaveLength(1)
    expect(lines[0].text).toBe('Real line')
  })

  it('returns empty array for empty input', () => {
    expect(parseLRC('')).toEqual([])
  })
})
