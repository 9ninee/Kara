import { describe, it, expect } from 'vitest'
import { CDGPlayer, CDG_WIDTH, CDG_HEIGHT } from './cdg'

// ── Synthetic CDG packet builders (24-byte sectors, command 0x09) ─────────

function packet(instruction: number, data: number[]): number[] {
  const p = new Array(24).fill(0)
  p[0] = 0x09
  p[1] = instruction
  for (let i = 0; i < data.length && i < 16; i++) p[4 + i] = data[i]
  return p
}

function memoryPreset(color: number): number[] {
  return packet(1, [color, 0])
}

function borderPreset(color: number): number[] {
  return packet(2, [color])
}

/** Load colors 0-7. Each color is 4-bit RGB packed as XXrrrrgg XXggbbbb */
function loadColorsLow(colors: Array<[number, number, number]>): number[] {
  const d: number[] = []
  for (let i = 0; i < 8; i++) {
    const [r, g, b] = colors[i] ?? [0, 0, 0]
    d.push(((r & 0x0f) << 2) | ((g & 0x0c) >> 2))
    d.push(((g & 0x03) << 4) | (b & 0x0f))
  }
  return packet(30, d)
}

/** Draw a 6×12 tile at CDG screen tile coords (row, col); border is row/col 0 */
function tileBlock(color0: number, color1: number, row: number, col: number, rows: number[], xor = false): number[] {
  return packet(xor ? 38 : 6, [color0, color1, row, col, ...rows])
}

function scrollPreset(fillColor: number, hCmd: number, vCmd: number): number[] {
  return packet(20, [fillColor, hCmd << 4, vCmd << 4])
}

function makePlayer(...packets: number[][]): CDGPlayer {
  const bytes = packets.flat()
  const buf = new ArrayBuffer(bytes.length)
  new Uint8Array(buf).set(bytes)
  return new CDGPlayer(buf)
}

/** Time that guarantees all N packets have been processed (300 sectors/s) */
function timeForSectors(n: number): number {
  return Math.ceil((n / 300) * 1000) + 10
}

function pixelAt(pixels: Uint8ClampedArray, x: number, y: number): [number, number, number] {
  const i = (y * CDG_WIDTH + x) * 4
  return [pixels[i], pixels[i + 1], pixels[i + 2]]
}

const RED: [number, number, number] = [15, 0, 0]
const GREEN: [number, number, number] = [0, 15, 0]
const BLUE: [number, number, number] = [0, 0, 15]

describe('CDGPlayer', () => {
  it('reports duration from sector count', () => {
    const player = makePlayer(...Array.from({ length: 300 }, () => memoryPreset(0)))
    expect(player.durationMs).toBe(1000)
  })

  it('decodes 4-bit RGB palette entries (scaled ×17)', () => {
    const player = makePlayer(
      loadColorsLow([RED, GREEN, BLUE, [15, 15, 15], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]),
      memoryPreset(1), // fill screen with palette[1] = green
    )
    const { pixels } = player.seek(timeForSectors(2))
    expect(pixelAt(pixels, 0, 0)).toEqual([0, 255, 0])
    expect(pixelAt(pixels, CDG_WIDTH - 1, CDG_HEIGHT - 1)).toEqual([0, 255, 0])
  })

  it('offsets tiles by the border: tile (1,1) draws at visible origin (0,0)', () => {
    // All 6 pixels of every row set → solid tile of color1
    const solid = Array(12).fill(0x3f)
    const player = makePlayer(
      loadColorsLow([[0, 0, 0], RED]),
      tileBlock(0, 1, 1, 1, solid),
    )
    const { pixels } = player.seek(timeForSectors(2))
    expect(pixelAt(pixels, 0, 0)).toEqual([255, 0, 0])
    expect(pixelAt(pixels, 5, 11)).toEqual([255, 0, 0])
    expect(pixelAt(pixels, 6, 0)).toEqual([0, 0, 0]) // next tile untouched
  })

  it('draws the last visible tile (row 16, col 48) at the bottom-right corner', () => {
    const solid = Array(12).fill(0x3f)
    const player = makePlayer(
      loadColorsLow([[0, 0, 0], RED]),
      tileBlock(0, 1, 16, 48, solid),
    )
    const { pixels } = player.seek(timeForSectors(2))
    expect(pixelAt(pixels, CDG_WIDTH - 1, CDG_HEIGHT - 1)).toEqual([255, 0, 0])
    expect(pixelAt(pixels, CDG_WIDTH - 6, CDG_HEIGHT - 12)).toEqual([255, 0, 0])
  })

  it('ignores border tiles (row 0 / col 0) without wrapping into the visible area', () => {
    const solid = Array(12).fill(0x3f)
    const player = makePlayer(
      loadColorsLow([[0, 0, 0], RED]),
      tileBlock(0, 1, 0, 0, solid),
    )
    const { pixels } = player.seek(timeForSectors(2))
    expect(pixelAt(pixels, 0, 0)).toEqual([0, 0, 0])
  })

  it('XOR tile flips color indices against the existing screen', () => {
    const solid = Array(12).fill(0x3f)
    const player = makePlayer(
      loadColorsLow([[0, 0, 0], RED, GREEN, BLUE]), // 1^2 = 3 → blue
      memoryPreset(1),
      tileBlock(0, 2, 1, 1, solid, true),
    )
    const { pixels } = player.seek(timeForSectors(3))
    expect(pixelAt(pixels, 0, 0)).toEqual([0, 0, 255])
    expect(pixelAt(pixels, 6, 0)).toEqual([255, 0, 0]) // outside tile: still red
  })

  it('scroll preset fills the vacated strip with the packet color, not the border color', () => {
    const player = makePlayer(
      loadColorsLow([[0, 0, 0], RED, GREEN, BLUE]),
      borderPreset(3), // border blue — must NOT be used as fill
      memoryPreset(1), // screen red
      scrollPreset(2, 1, 0), // scroll right 6px, fill with green
    )
    const { pixels } = player.seek(timeForSectors(4))
    expect(pixelAt(pixels, 0, 0)).toEqual([0, 255, 0]) // vacated left strip = fill color
    expect(pixelAt(pixels, 6, 0)).toEqual([255, 0, 0]) // shifted content
  })

  it('rewinds by replaying from the start', () => {
    const solid = Array(12).fill(0x3f)
    const player = makePlayer(
      loadColorsLow([[0, 0, 0], RED]),
      memoryPreset(0),
      tileBlock(0, 1, 1, 1, solid),
    )
    player.seek(timeForSectors(3))
    // seek backwards to just after packet 2 (memory preset) but before the tile:
    // sector 2 covers 6.67–10 ms at 300 sectors/sec
    const { pixels } = player.seek(7)
    expect(pixelAt(pixels, 0, 0)).toEqual([0, 0, 0])
  })

  it('tolerates truncated/garbage data without throwing', () => {
    const garbage = new ArrayBuffer(37)
    new Uint8Array(garbage).fill(0xff)
    const player = new CDGPlayer(garbage)
    expect(() => player.seek(5000)).not.toThrow()
  })
})
