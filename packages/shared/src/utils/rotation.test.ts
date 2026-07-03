import { describe, it, expect } from 'vitest'
import { computeFairOrder } from './rotation'
import type { QueueItem, Song } from '../index'

let counter = 0
function item(requestedBy: string, title = `song-${counter}`): QueueItem {
  counter++
  return {
    id: `item-${counter}`,
    song: { id: `s-${counter}`, title, artist: 'a', duration: 0, source: 'local', audioPath: '/x.mp3', addedAt: counter, playCount: 0 } as Song,
    requestedBy,
    addedAt: counter,
    skipVotes: [],
  }
}

function order(items: QueueItem[]): string[] {
  return computeFairOrder(items).map((i) => i.requestedBy)
}

describe('computeFairOrder', () => {
  it('keeps FIFO order for distinct singers', () => {
    expect(order([item('A'), item('B'), item('C')])).toEqual(['A', 'B', 'C'])
  })

  it('interleaves rounds so one singer cannot dominate', () => {
    // A queues 3 songs, then B and C each queue one
    const items = [item('A'), item('A'), item('A'), item('B'), item('C')]
    expect(order(items)).toEqual(['A', 'B', 'C', 'A', 'A'])
  })

  it('slots a latecomer into the current round', () => {
    // A and B each queued two songs, then D joins
    const items = [item('A'), item('B'), item('A'), item('B'), item('D')]
    expect(order(items)).toEqual(['A', 'B', 'D', 'A', 'B'])
  })

  it('preserves each singer\'s own song order', () => {
    const a1 = item('A', 'first')
    const b1 = item('B', 'b-first')
    const a2 = item('A', 'second')
    const result = computeFairOrder([a1, b1, a2])
    expect(result.map((i) => i.song.title)).toEqual(['first', 'b-first', 'second'])
  })

  it('handles empty queue', () => {
    expect(computeFairOrder([])).toEqual([])
  })

  it('does not mutate the input array', () => {
    const items = [item('A'), item('A'), item('B')]
    const snapshot = [...items]
    computeFairOrder(items)
    expect(items).toEqual(snapshot)
  })
})
