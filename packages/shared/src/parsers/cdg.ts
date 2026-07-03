/**
 * CDG (CD+Graphics) sector parser.
 *
 * CDG data is interleaved with audio at 300 sectors/sec.
 * Each sector is 24 bytes. Only sectors with a subchannel command of 0x09
 * carry CDG instructions.
 *
 * Reference: https://jbum.com/cdg_revealed.html
 */

const CDG_MAGIC = 0x09
const CDG_COMMAND_MASK = 0x3f

const CDG_CMD_MEMORY_PRESET = 1
const CDG_CMD_BORDER_PRESET = 2
const CDG_CMD_TILE_BLOCK = 6
const CDG_CMD_SCROLL_PRESET = 20
const CDG_CMD_SCROLL_COPY = 24
const CDG_CMD_DEF_TRANSPARENT = 28
const CDG_CMD_LOAD_COLORS_LOW = 30
const CDG_CMD_LOAD_COLORS_HIGH = 31
const CDG_CMD_TILE_BLOCK_XOR = 38

export const CDG_WIDTH = 288
export const CDG_HEIGHT = 192
const CDG_VISIBLE_WIDTH = 294
const CDG_VISIBLE_HEIGHT = 204

const SECTORS_PER_SECOND = 300

/** Decoded state at a point in time, ready to render */
export interface CDGState {
  /** RGBA flat array, CDG_WIDTH × CDG_HEIGHT */
  pixels: Uint8ClampedArray<ArrayBuffer>
  timeMs: number
}

interface Color {
  r: number
  g: number
  b: number
}

export class CDGPlayer {
  private data: Uint8Array
  private palette: Color[] = Array.from({ length: 16 }, () => ({ r: 0, g: 0, b: 0 }))
  private colorIndex: Uint8Array = new Uint8Array(CDG_WIDTH * CDG_HEIGHT)
  private borderColorIndex = 0
  private sectorIndex = 0
  private readonly totalSectors: number

  constructor(buffer: ArrayBuffer) {
    this.data = new Uint8Array(buffer)
    this.totalSectors = Math.floor(this.data.length / 24)
  }

  get durationMs(): number {
    return (this.totalSectors / SECTORS_PER_SECOND) * 1000
  }

  reset(): void {
    this.sectorIndex = 0
    this.palette = Array.from({ length: 16 }, () => ({ r: 0, g: 0, b: 0 }))
    this.colorIndex = new Uint8Array(CDG_WIDTH * CDG_HEIGHT)
    this.borderColorIndex = 0
  }

  /** Advance to the sector corresponding to timeMs and return rendered pixels */
  seek(timeMs: number): CDGState {
    const targetSector = Math.floor((timeMs / 1000) * SECTORS_PER_SECOND)
    if (targetSector < this.sectorIndex) this.reset()
    while (this.sectorIndex < targetSector && this.sectorIndex < this.totalSectors) {
      this.processSector(this.sectorIndex)
      this.sectorIndex++
    }
    return { pixels: this.render(), timeMs }
  }

  private processSector(index: number): void {
    const offset = index * 24
    const command = this.data[offset] & CDG_COMMAND_MASK
    if (command !== CDG_MAGIC) return

    const instruction = this.data[offset + 1] & CDG_COMMAND_MASK
    const d = this.data.subarray(offset + 4, offset + 20)

    switch (instruction) {
      case CDG_CMD_MEMORY_PRESET:
        this.memoryPreset(d)
        break
      case CDG_CMD_BORDER_PRESET:
        this.borderPreset(d)
        break
      case CDG_CMD_TILE_BLOCK:
        this.tileBlock(d, false)
        break
      case CDG_CMD_TILE_BLOCK_XOR:
        this.tileBlock(d, true)
        break
      case CDG_CMD_LOAD_COLORS_LOW:
        this.loadColors(d, 0)
        break
      case CDG_CMD_LOAD_COLORS_HIGH:
        this.loadColors(d, 8)
        break
      case CDG_CMD_SCROLL_PRESET:
      case CDG_CMD_SCROLL_COPY:
        this.scroll(d, instruction === CDG_CMD_SCROLL_COPY)
        break
      case CDG_CMD_DEF_TRANSPARENT:
      default:
        break
    }
  }

  private memoryPreset(d: Uint8Array): void {
    const color = d[0] & 0x0f
    this.colorIndex.fill(color)
  }

  private borderPreset(d: Uint8Array): void {
    this.borderColorIndex = d[0] & 0x0f
  }

  private loadColors(d: Uint8Array, base: number): void {
    for (let i = 0; i < 8; i++) {
      const hi = d[i * 2]
      const lo = d[i * 2 + 1]
      const r = ((hi & 0x3c) >> 2) * 17
      const g = (((hi & 0x03) << 2) | ((lo & 0x30) >> 4)) * 17
      const b = (lo & 0x0f) * 17
      this.palette[base + i] = { r, g, b }
    }
  }

  private tileBlock(d: Uint8Array, xor: boolean): void {
    const color0 = d[0] & 0x0f
    const color1 = d[1] & 0x0f
    // Tile coordinates address the full 300×216 CDG screen where row 0 /
    // col 0 form the border; the visible 288×192 window starts at (6,12).
    const row = (d[2] & 0x1f) * 12 - 12
    const col = (d[3] & 0x3f) * 6 - 6

    for (let r = 0; r < 12; r++) {
      const byte = d[4 + r]
      for (let c = 0; c < 6; c++) {
        const bit = (byte >> (5 - c)) & 0x01
        const x = col + c
        const y = row + r
        if (x < 0 || y < 0 || x >= CDG_WIDTH || y >= CDG_HEIGHT) continue
        const pixIdx = y * CDG_WIDTH + x
        if (xor) {
          this.colorIndex[pixIdx] ^= bit ? color1 : color0
        } else {
          this.colorIndex[pixIdx] = bit ? color1 : color0
        }
      }
    }
  }

  private scroll(d: Uint8Array, copy: boolean): void {
    // Scroll Preset fills the vacated area with the color in data byte 0
    // (per CDG spec), NOT the border color. Scroll Copy wraps instead.
    const fillColor = d[0] & 0x0f
    const hScroll = d[1] & 0x3f
    const vScroll = d[2] & 0x3f
    const hCmd = (hScroll >> 4) & 0x03
    const vCmd = (vScroll >> 4) & 0x03

    const dx = hCmd === 2 ? -6 : hCmd === 1 ? 6 : 0
    const dy = vCmd === 2 ? -12 : vCmd === 1 ? 12 : 0

    if (dx === 0 && dy === 0) return

    const old = new Uint8Array(this.colorIndex)
    const fill = fillColor

    for (let y = 0; y < CDG_HEIGHT; y++) {
      for (let x = 0; x < CDG_WIDTH; x++) {
        const srcX = x - dx
        const srcY = y - dy
        const dst = y * CDG_WIDTH + x
        if (srcX < 0 || srcX >= CDG_WIDTH || srcY < 0 || srcY >= CDG_HEIGHT) {
          if (copy) {
            const wx = ((srcX % CDG_WIDTH) + CDG_WIDTH) % CDG_WIDTH
            const wy = ((srcY % CDG_HEIGHT) + CDG_HEIGHT) % CDG_HEIGHT
            this.colorIndex[dst] = old[wy * CDG_WIDTH + wx]
          } else {
            this.colorIndex[dst] = fill
          }
        } else {
          this.colorIndex[dst] = old[srcY * CDG_WIDTH + srcX]
        }
      }
    }
  }

  private render(): Uint8ClampedArray<ArrayBuffer> {
    const pixels = new Uint8ClampedArray(CDG_WIDTH * CDG_HEIGHT * 4)
    for (let i = 0; i < CDG_WIDTH * CDG_HEIGHT; i++) {
      const { r, g, b } = this.palette[this.colorIndex[i]]
      pixels[i * 4] = r
      pixels[i * 4 + 1] = g
      pixels[i * 4 + 2] = b
      pixels[i * 4 + 3] = 255
    }
    return pixels
  }
}
