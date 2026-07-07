import type { QueueItem } from '../types/queue'

/**
 * Fair-play singer rotation (round-robin), the queue model used by
 * PiKaraoke, Karaoke Eternal and OpenKJ.
 *
 * Each singer's pending songs are numbered 0, 1, 2… (their "round").
 * The queue is ordered by round first, then by request time within a
 * round. A latecomer's first song therefore enters the *current* round
 * and plays after each existing singer's current song — instead of
 * waiting behind one enthusiastic guest's entire backlog.
 */
export function computeFairOrder(items: QueueItem[], nowPlayingSinger?: string): QueueItem[] {
  const roundBySinger = new Map<string, number>()
  // The singer currently on the mic has already used this round — their
  // next pending song belongs to round 1, behind everyone's first song.
  if (nowPlayingSinger) roundBySinger.set(nowPlayingSinger, 1)
  const decorated = items.map((item, index) => {
    const singer = item.requestedBy
    const round = roundBySinger.get(singer) ?? 0
    roundBySinger.set(singer, round + 1)
    return { item, round, index }
  })
  decorated.sort((a, b) => a.round - b.round || a.index - b.index)
  return decorated.map((d) => d.item)
}
