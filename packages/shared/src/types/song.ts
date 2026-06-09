export type ContentSource = 'local' | 'youtube' | 'karaoke-api'

export interface Song {
  id: string
  title: string
  artist: string
  duration: number
  source: ContentSource
  /** Absolute local path or remote URL to the MP3 backing track */
  audioPath: string
  /** Absolute local path or remote URL to the CDG graphics file (optional — LRC used if absent) */
  cdgPath?: string
  /** Absolute local path or remote URL to the LRC lyrics file (optional) */
  lrcPath?: string
  addedAt: number
  lastPlayedAt?: number
  playCount: number
  coverUrl?: string
}

export interface LyricsLine {
  startMs: number
  endMs: number
  text: string
}

/** One decoded CDG graphics frame ready to blit onto a canvas */
export interface CDGFrame {
  /** Frame index in the CDG stream */
  index: number
  /** Timestamp in milliseconds at which this frame should be displayed */
  timeMs: number
  /** RGBA pixel data — always 288 × 192 pixels */
  pixels: Uint8ClampedArray<ArrayBuffer>
}

export interface CDGPalette {
  colors: Array<{ r: number; g: number; b: number; a: number }>
}
