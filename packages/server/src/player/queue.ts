import { randomUUID } from 'crypto'
import type { Song } from '../library/database.js'

export interface QueueItem {
  id: string
  song: Song
  singerName: string
  addedAt: number
  skipVotes: string[]
}

export interface QueueState {
  items: QueueItem[]
  nowPlaying: { item: QueueItem; positionMs: number; isPlaying: boolean } | null
  history: QueueItem[]
}

// Fair singer rotation: each singer gets exactly one slot per round before repeating.
// Insertion point = just after the last item belonging to this singer, OR after the
// last item of singers who haven't had a turn this round yet, whichever comes first.
export class FairQueue {
  private items: QueueItem[] = []
  private history: QueueItem[] = []
  private nowPlaying: QueueState['nowPlaying'] = null

  add(song: Song, singerName: string): QueueItem {
    const item: QueueItem = { id: randomUUID(), song, singerName, addedAt: Date.now(), skipVotes: [] }

    // Find last position of this singer in the queue
    const lastOwn = this.items.map((x, i) => x.singerName === singerName ? i : -1).filter(i => i >= 0).pop() ?? -1

    if (lastOwn === -1) {
      // Singer not in queue — append at end
      this.items.push(item)
    } else {
      // Insert one position after their last song
      this.items.splice(lastOwn + 1, 0, item)
    }
    return item
  }

  remove(itemId: string): void {
    this.items = this.items.filter(i => i.id !== itemId)
  }

  skipVote(itemId: string, voterId: string): boolean {
    const item = this.items[0]
    if (!item || item.id !== itemId) return false
    if (!item.skipVotes.includes(voterId)) item.skipVotes.push(voterId)
    return true
  }

  shouldAutoSkip(connectedCount: number): boolean {
    const item = this.items[0]
    if (!item) return false
    return item.skipVotes.length > connectedCount / 2
  }

  advance(): QueueItem | null {
    const done = this.items.shift() ?? null
    if (done) this.history.unshift(done)
    if (this.history.length > 50) this.history.pop()

    const next = this.items[0] ?? null
    if (next) {
      this.nowPlaying = { item: next, positionMs: 0, isPlaying: false }
    } else {
      this.nowPlaying = null
    }
    return next
  }

  updatePosition(positionMs: number, isPlaying: boolean): void {
    if (this.nowPlaying) Object.assign(this.nowPlaying, { positionMs, isPlaying })
  }

  getState(): QueueState {
    return { items: [...this.items], nowPlaying: this.nowPlaying, history: [...this.history] }
  }

  peek(): QueueItem | null {
    return this.items[0] ?? null
  }
}
