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

// Fair singer rotation: songs are grouped into implicit "rounds" — a singer's Nth
// queued song belongs to round N. New songs are inserted before the first item of
// a later round, so every singer gets one turn per round regardless of how many
// songs anyone has queued.
export class FairQueue {
  private items: QueueItem[] = []
  private history: QueueItem[] = []
  private current: QueueItem | null = null
  private positionMs = 0
  private isPlaying = false

  add(song: Song, singerName: string): QueueItem {
    const item: QueueItem = { id: randomUUID(), song, singerName, addedAt: Date.now(), skipVotes: [] }

    // Round of the new item = how many songs this singer already has queued + 1
    const round = this.items.filter(i => i.singerName === singerName).length + 1

    // Insert before the first item belonging to a later round
    const occurrences = new Map<string, number>()
    let insertAt = this.items.length
    for (let i = 0; i < this.items.length; i++) {
      const n = (occurrences.get(this.items[i].singerName) ?? 0) + 1
      occurrences.set(this.items[i].singerName, n)
      if (n > round) { insertAt = i; break }
    }
    this.items.splice(insertAt, 0, item)
    return item
  }

  remove(itemId: string): boolean {
    const before = this.items.length
    this.items = this.items.filter(i => i.id !== itemId)
    return this.items.length < before
  }

  // Returns the voted item, or null if not found. Votes are allowed on the
  // currently playing item and on any upcoming item.
  skipVote(itemId: string, voterId: string): QueueItem | null {
    const item = this.current?.id === itemId ? this.current : this.items.find(i => i.id === itemId)
    if (!item) return null
    if (!item.skipVotes.includes(voterId)) item.skipVotes.push(voterId)
    return item
  }

  static hasMajority(item: QueueItem, connectedCount: number): boolean {
    return item.skipVotes.length > connectedCount / 2
  }

  // Retire the current item into history and promote the next queued item.
  advance(): QueueItem | null {
    if (this.current) {
      this.history.unshift(this.current)
      if (this.history.length > 50) this.history.pop()
    }
    this.current = this.items.shift() ?? null
    this.positionMs = 0
    return this.current
  }

  getNowPlaying(): QueueItem | null {
    return this.current
  }

  updatePosition(positionMs: number, isPlaying: boolean): void {
    this.positionMs = positionMs
    this.isPlaying = isPlaying
  }

  getState(): QueueState {
    return {
      items: [...this.items],
      nowPlaying: this.current ? { item: this.current, positionMs: this.positionMs, isPlaying: this.isPlaying } : null,
      history: [...this.history],
    }
  }
}
