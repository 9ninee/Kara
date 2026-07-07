import { createServer } from 'http'
import { Server } from 'socket.io'
import { getSongs } from '../library/database'
import { startDiscovery, stopDiscovery } from './discovery'
import { startMediaServer } from './mediaServer'
import { randomUUID } from 'crypto'
import { computeFairOrder } from '@kara/shared'
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  PartySession,
  QueueState,
  NowPlaying,
  Participant,
} from '@kara/shared'

let httpServer: ReturnType<typeof createServer> | null = null
let io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null = null
let session: PartySession | null = null
let playbackTick: ReturnType<typeof setInterval> | null = null
let cachedQrDataUrl = ''
let notifyQueueUpdate: ((queue: QueueState) => void) | undefined
let notifyPlaybackStarted: ((nowPlaying: NowPlaying) => void) | undefined

const HOST_ID = 'host'
const PORT = 3000
/** Grace period past the song's known duration before the server force-advances */
const AUTO_ADVANCE_GRACE_MS = 3000

function emptyQueue(): QueueState {
  return { items: [], nowPlaying: null, history: [] }
}

function broadcastQueue(): void {
  if (!io || !session) return
  io.emit('queue:updated', session.queue)
  notifyQueueUpdate?.(session.queue)
}

function finishCurrentSong(): void {
  if (!session?.queue.nowPlaying) return
  const np = session.queue.nowPlaying
  session.queue.history.push({
    queueItemId: np.queueItemId,
    songId: np.song.id,
    playedAt: Date.now(),
    title: np.song.title,
    artist: np.song.artist,
  })
}

function advanceQueue(): void {
  if (!io || !session) return
  const next = session.queue.items.shift()
  if (next) {
    const nowPlaying: NowPlaying = {
      queueItemId: next.id,
      song: next.song,
      requestedBy: next.requestedBy,
      startedAt: Date.now(),
      positionMs: 0,
      isPlaying: true,
    }
    session.queue.nowPlaying = nowPlaying
    io.emit('playback:started', nowPlaying)
    notifyPlaybackStarted?.(nowPlaying)
  } else {
    session.queue.nowPlaying = null
    io.emit('playback:ended')
  }
}

/** Host-driven advance (e.g. the desktop player's audio actually ended). */
export function advancePartyQueue(): void {
  if (!io || !session) return
  finishCurrentSong()
  advanceQueue()
  broadcastQueue()
}

export function getPartyStatus(): {
  active: boolean
  sessionId: string | null
  port: number
  qrDataUrl: string
  queue: QueueState | null
} {
  return {
    active: !!session,
    sessionId: session?.id ?? null,
    port: PORT,
    qrDataUrl: cachedQrDataUrl,
    queue: session?.queue ?? null,
  }
}

export async function startPartyServer(
  onQueueUpdate?: (queue: QueueState) => void,
  onPlaybackStarted?: (nowPlaying: NowPlaying) => void,
): Promise<{ sessionId: string; port: number; qrDataUrl: string }> {
  if (io && session) {
    // Already running — keep serving the same session (and its QR code)
    notifyQueueUpdate = onQueueUpdate ?? notifyQueueUpdate
    notifyPlaybackStarted = onPlaybackStarted ?? notifyPlaybackStarted
    return { sessionId: session.id, port: PORT, qrDataUrl: cachedQrDataUrl }
  }

  notifyQueueUpdate = onQueueUpdate
  notifyPlaybackStarted = onPlaybackStarted

  session = {
    id: randomUUID(),
    hostId: HOST_ID,
    participants: [],
    queue: emptyQueue(),
    createdAt: Date.now(),
  }

  const media = await startMediaServer()

  httpServer = createServer((req, res) => {
    if (req.url === '/api/library' && req.method === 'GET') {
      // Guests can't read host-local file paths — attach a streamable LAN URL
      const songs = getSongs().map((s) => ({ ...s, mediaUrl: media.getUrl(s.audioPath) }))
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
      res.end(JSON.stringify(songs))
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  io = new Server(httpServer, { cors: { origin: '*' } })

  // 1 Hz position sync + fallback auto-advance if the host player stalls out
  playbackTick = setInterval(() => {
    const np = session?.queue?.nowPlaying
    if (!np?.isPlaying || !io) return
    const elapsed = Date.now() - np.startedAt + np.positionMs
    const durationMs = np.song.duration > 0 ? np.song.duration * 1000 : 0
    if (durationMs && elapsed >= durationMs + AUTO_ADVANCE_GRACE_MS) {
      advancePartyQueue()
      return
    }
    io.emit('playback:tick', elapsed)
  }, 1000)

  io.on('connection', (socket) => {
    socket.on('session:join', ({ name }) => {
      if (!session) return
      const participant: Participant = { id: socket.id, name, isHost: false, joinedAt: Date.now() }
      socket.data.participant = participant
      socket.data.sessionId = session.id
      session.participants.push(participant)
      socket.emit('session:joined', session)
      socket.broadcast.emit('session:participant-joined', participant)
    })

    socket.on('queue:add', (song) => {
      if (!session) return
      session.queue.items.push({
        id: randomUUID(),
        song,
        requestedBy: socket.data.participant?.name ?? 'Guest',
        addedAt: Date.now(),
        skipVotes: [],
      })
      // Fair-play rotation: interleave singers round-robin so nobody dominates.
      // The current singer's pending songs count as round 1+ — their song on
      // the mic already used this round.
      session.queue.items = computeFairOrder(
        session.queue.items,
        session.queue.nowPlaying?.requestedBy,
      )
      if (!session.queue.nowPlaying) advanceQueue()
      broadcastQueue()
    })

    socket.on('queue:remove', (itemId) => {
      if (!session) return
      session.queue.items = session.queue.items.filter((i) => i.id !== itemId)
      broadcastQueue()
    })

    socket.on('queue:reorder', (fromIndex, toIndex) => {
      if (!session) return
      const items = session.queue.items
      if (
        !Number.isInteger(fromIndex) || !Number.isInteger(toIndex) ||
        fromIndex < 0 || fromIndex >= items.length ||
        toIndex < 0 || toIndex >= items.length
      ) return
      const [moved] = items.splice(fromIndex, 1)
      items.splice(toIndex, 0, moved)
      broadcastQueue()
    })

    socket.on('queue:skip-vote', (itemId) => {
      if (!session) return
      const item = session.queue.items.find((i) => i.id === itemId)
      if (item && !item.skipVotes.includes(socket.id)) {
        item.skipVotes.push(socket.id)
        const majority = Math.floor(session.participants.length / 2) + 1
        if (item.skipVotes.length >= majority) {
          session.queue.items = session.queue.items.filter((i) => i.id !== itemId)
        }
      }
      broadcastQueue()
    })

    socket.on('playback:next', () => {
      advancePartyQueue()
    })

    socket.on('playback:play', () => {
      if (!session) return
      const np = session.queue.nowPlaying
      if (np && !np.isPlaying) {
        np.isPlaying = true
        np.startedAt = Date.now()
        io?.emit('playback:resumed', np.positionMs)
        notifyQueueUpdate?.(session.queue)
      }
    })

    socket.on('playback:pause', () => {
      if (!session) return
      const np = session.queue.nowPlaying
      if (np && np.isPlaying) {
        np.positionMs = Date.now() - np.startedAt + np.positionMs
        np.isPlaying = false
        io?.emit('playback:paused', np.positionMs)
        notifyQueueUpdate?.(session.queue)
      }
    })

    socket.on('playback:seek', (positionMs) => {
      if (!session) return
      const np = session.queue.nowPlaying
      if (np && typeof positionMs === 'number' && positionMs >= 0) {
        np.positionMs = positionMs
        np.startedAt = Date.now()
        io?.emit('playback:seeked', positionMs)
        notifyQueueUpdate?.(session.queue)
      }
    })

    socket.on('disconnect', () => {
      if (!session) return
      session.participants = session.participants.filter((p) => p.id !== socket.id)
      io?.emit('session:participant-left', socket.id)
    })

    socket.on('error', (err) => {
      console.error('[party] socket error', err)
    })
  })

  io.on('error', (err) => {
    console.error('[party] io error', err)
  })

  await new Promise<void>((resolve) => httpServer!.listen(PORT, resolve))
  cachedQrDataUrl = await startDiscovery(session.id, PORT)

  return { sessionId: session.id, port: PORT, qrDataUrl: cachedQrDataUrl }
}

export async function stopPartyServer(): Promise<void> {
  if (playbackTick) { clearInterval(playbackTick); playbackTick = null }
  await stopDiscovery()
  if (io) { io.close(); io = null }
  if (httpServer) { httpServer.close(); httpServer = null }
  session = null
  cachedQrDataUrl = ''
  notifyQueueUpdate = undefined
  notifyPlaybackStarted = undefined
}
