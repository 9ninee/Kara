import { Server as IOServer, Socket } from 'socket.io'
import { FairQueue } from '../player/queue.js'
import { getSong, recordPlay, searchSongs, getArtists, getSongsByArtist } from '../library/database.js'
import { Server as HTTPServer } from 'http'
import { randomBytes } from 'crypto'

export interface PlaybackState {
  songId: string | null
  positionMs: number
  isPlaying: boolean
  duration: number
}

const queue = new FairQueue()
const playback: PlaybackState = { songId: null, positionMs: 0, isPlaying: false, duration: 0 }

// Tick loop: push playback position to all clients every 500ms
let tickInterval: NodeJS.Timeout | null = null

export function createSocketServer(httpServer: HTTPServer): IOServer {
  const io = new IOServer(httpServer, { cors: { origin: '*' } })

  function broadcast() {
    io.emit('state', { queue: queue.getState(), playback })
  }

  tickInterval = setInterval(() => {
    if (playback.isPlaying) {
      playback.positionMs += 500
      io.emit('tick', { positionMs: playback.positionMs })
    }
  }, 500)

  io.on('connection', (socket: Socket) => {
    // Send current state on join
    socket.emit('state', { queue: queue.getState(), playback })

    socket.on('queue:add', ({ songId, singerName }: { songId: string; singerName: string }) => {
      const song = getSong(songId)
      if (!song) return
      queue.add(song, singerName)
      // Auto-start if nothing playing
      if (!playback.songId) {
        const next = queue.advance()
        if (next) {
          playback.songId = next.song.id
          playback.positionMs = 0
          playback.isPlaying = true
          playback.duration = next.song.duration
        }
      }
      broadcast()
    })

    socket.on('queue:remove', (itemId: string) => {
      queue.remove(itemId)
      broadcast()
    })

    socket.on('queue:skip-vote', (itemId: string) => {
      queue.skipVote(itemId, socket.id)
      const connected = io.engine.clientsCount
      if (queue.shouldAutoSkip(connected)) {
        advanceTrack(io, playback, queue)
      }
      broadcast()
    })

    socket.on('queue:skip-force', () => {
      advanceTrack(io, playback, queue)
      broadcast()
    })

    socket.on('playback:play', () => {
      playback.isPlaying = true
      broadcast()
    })

    socket.on('playback:pause', () => {
      playback.isPlaying = false
      broadcast()
    })

    socket.on('playback:seek', ({ positionMs }: { positionMs: number }) => {
      playback.positionMs = positionMs
      broadcast()
    })

    socket.on('playback:ended', () => {
      // Fired by the display client when the track finishes
      const current = queue.peek()
      if (current) recordPlay(current.song.id, current.singerName)
      advanceTrack(io, playback, queue)
      broadcast()
    })

    socket.on('disconnect', () => {
      broadcast()
    })
  })

  return io
}

function advanceTrack(io: IOServer, playback: PlaybackState, queue: FairQueue) {
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
  }
}
