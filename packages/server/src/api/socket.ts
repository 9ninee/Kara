import { Server as IOServer, Socket } from 'socket.io'
import { FairQueue } from '../player/queue.js'
import { getSong, recordPlay } from '../library/database.js'
import { Server as HTTPServer } from 'http'

export interface PlaybackState {
  songId: string | null
  positionMs: number
  isPlaying: boolean
  duration: number // seconds
}

const queue = new FairQueue()
const playback: PlaybackState = { songId: null, positionMs: 0, isPlaying: false, duration: 0 }

export function createSocketServer(httpServer: HTTPServer): IOServer {
  const io = new IOServer(httpServer, { cors: { origin: '*' } })

  // Tracked manually: io.engine.clientsCount still includes a departing
  // socket while its 'disconnect' handler runs.
  let connectedCount = 0

  function broadcast() {
    queue.updatePosition(playback.positionMs, playback.isPlaying)
    io.emit('state', {
      queue: queue.getState(),
      playback,
      connectedCount,
    })
  }

  function startNext() {
    const next = queue.advance()
    if (next) {
      playback.songId = next.song.id
      playback.positionMs = 0
      playback.isPlaying = true
      playback.duration = next.song.duration
    } else {
      playback.songId = null
      playback.positionMs = 0
      playback.isPlaying = false
      playback.duration = 0
    }
  }

  // Tick loop: push playback position to all clients every 500ms
  setInterval(() => {
    if (!playback.isPlaying) return
    playback.positionMs += 500
    queue.updatePosition(playback.positionMs, true)
    io.emit('tick', { positionMs: playback.positionMs })

    // Fallback auto-advance: if no display client reports 'ended' (e.g. nobody
    // has the player open), move on once we're past the known duration.
    if (playback.duration > 0 && playback.positionMs > playback.duration * 1000 + 3000) {
      const current = queue.getNowPlaying()
      if (current) recordPlay(current.song.id, current.singerName)
      startNext()
      broadcast()
    }
  }, 500)

  io.on('connection', (socket: Socket) => {
    connectedCount++
    broadcast() // includes the new client and updates everyone's connected count

    socket.on('queue:add', (payload: { songId: string; singerName: string }) => {
      const { songId, singerName } = payload ?? {}
      if (!songId || !singerName) return
      const song = getSong(songId)
      if (!song) return
      queue.add(song, singerName)
      if (!playback.songId) startNext()
      broadcast()
    })

    socket.on('queue:remove', (payload: { itemId: string } | string) => {
      const itemId = typeof payload === 'string' ? payload : payload?.itemId
      if (!itemId) return
      queue.remove(itemId)
      broadcast()
    })

    socket.on('queue:skip-vote', (payload: { itemId: string; voterId?: string } | string) => {
      const itemId = typeof payload === 'string' ? payload : payload?.itemId
      if (!itemId) return
      const voterId = (typeof payload === 'object' && payload?.voterId) || socket.id
      const item = queue.skipVote(itemId, voterId)
      if (!item) return

      if (FairQueue.hasMajority(item, connectedCount)) {
        if (queue.getNowPlaying()?.id === item.id) {
          startNext() // majority voted to skip the playing song
        } else {
          queue.remove(item.id) // majority voted an upcoming song out of the queue
        }
      }
      broadcast()
    })

    socket.on('queue:skip-force', () => {
      startNext()
      broadcast()
    })

    socket.on('playback:play', () => {
      if (!playback.songId) return
      playback.isPlaying = true
      broadcast()
    })

    socket.on('playback:pause', () => {
      playback.isPlaying = false
      broadcast()
    })

    socket.on('playback:seek', (payload: { positionMs: number } | number) => {
      const positionMs = typeof payload === 'number' ? payload : payload?.positionMs
      if (typeof positionMs !== 'number' || positionMs < 0) return
      playback.positionMs = positionMs
      broadcast()
    })

    // Fired by display clients when the <audio> element finishes. Multiple
    // clients may all fire this — the songId check makes it idempotent: the
    // first event advances the track, subsequent ones no longer match.
    socket.on('playback:ended', (payload?: { songId?: string }) => {
      const endedSongId = payload?.songId
      if (endedSongId && endedSongId !== playback.songId) return
      const current = queue.getNowPlaying()
      if (current) recordPlay(current.song.id, current.singerName)
      startNext()
      broadcast()
    })

    socket.on('disconnect', () => {
      connectedCount = Math.max(0, connectedCount - 1)
      broadcast()
    })
  })

  return io
}
