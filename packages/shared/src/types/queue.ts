import type { Song } from './song.js'

export interface QueueItem {
  id: string
  song: Song
  requestedBy: string
  addedAt: number
  /** Skip votes cast by participant IDs */
  skipVotes: string[]
}

export interface NowPlaying {
  queueItemId: string
  song: Song
  startedAt: number
  pausedAt?: number
  /** Current playback position in milliseconds, as of startedAt */
  positionMs: number
  isPlaying: boolean
}

export interface QueueState {
  items: QueueItem[]
  nowPlaying: NowPlaying | null
  history: Array<{ queueItemId: string; songId: string; playedAt: number }>
}
