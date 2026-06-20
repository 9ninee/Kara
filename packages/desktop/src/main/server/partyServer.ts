import { createServer } from 'http'
import { Server } from 'socket.io'
import { getSongs } from '../library/database'
import { startDiscovery, stopDiscovery } from './discovery'
import { randomUUID } from 'crypto'
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

const HOST_ID = 'host'
const PORT = 3000

function emptyQueue(): QueueState {
  return { items: [], nowPlaying: null, history: [] }
}

export async function startPartyServer(
  onQueueUpdate?: (queue: QueueState) => void,
): Promise<{ sessionId: string; port: number; qrDataUrl: string }> {
  if (io) {
    return { sessionId: session!.id, port: PORT, qrDataUrl: '' }
  }

  session = {
    id: randomUUID(),
    hostId: HOST_ID,
    participants: [],
    queue: emptyQueue(),
    createdAt: Date.now(),
  }

  httpServer = createServer((req, res) => {
    if (req.url === '/api/library' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
      res.end(JSON.stringify(getSongs()))
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  io = new Server(httpServer, { cors: { origin: '*' } })

  function broadcastQueue(): void {
    io!.emit('queue:updated', session!.queue)
    onQueueUpdate?.(session!.queue)
  }

  function advanceQueue(): void {
    const next = session!.queue.items.shift()
    if (next) {
      const nowPlaying: NowPlaying = {
        queueItemId: next.id,
        song: next.song,
        startedAt: Date.now(),
        positionMs: 0,
        isPlaying: true,
      }
      session!.queue.nowPlaying = nowPlaying
      io!.emit('playback:started', nowPlaying)
    } else {
      session!.queue.nowPlaying = null
      io!.emit('playback:ended')
    }
  }

  // Tick loop: keep clients synced on position every second
  playbackTick = setInterval(() => {
    const np = session?.queue?.nowPlaying
    if (!np?.isPlaying || !io) return
    // Recompute positionMs from wall-clock
    const elapsed = Date.now() - np.startedAt + (np.positionMs ?? 0)
    io.emit('playback:seeked', elapsed)
  }, 1000)

  io.on('connection', (socket) => {
    socket.on('session:join', ({ name }) => {
      const participant: Participant = { id: socket.id, name, isHost: false, joinedAt: Date.now() }
      socket.data.participant = participant
      socket.data.sessionId = session!.id
      session!.participants.push(participant)
      socket.emit('session:joined', session!)
      socket.broadcast.emit('session:participant-joined', participant)
    })

    socket.on('queue:add', (song) => {
      session!.queue.items.push({
        id: randomUUID(),
        song,
        requestedBy: socket.data.participant?.name ?? 'Guest',
        addedAt: Date.now(),
        skipVotes: [],
      })
      if (!session!.queue.nowPlaying) advanceQueue()
      broadcastQueue()
    })

    socket.on('queue:remove', (itemId) => {
      session!.queue.items = session!.queue.items.filter((i) => i.id !== itemId)
      broadcastQueue()
    })

    socket.on('queue:skip-vote', (itemId) => {
      const item = session!.queue.items.find((i) => i.id === itemId)
      if (item && !item.skipVotes.includes(socket.id)) {
        item.skipVotes.push(socket.id)
        const majority = Math.floor(session!.participants.length / 2) + 1
        if (item.skipVotes.length >= majority) {
          session!.queue.items = session!.queue.items.filter((i) => i.id !== itemId)
        }
      }
      broadcastQueue()
    })

    socket.on('playback:next', () => {
      if (session!.queue.nowPlaying) {
        session!.queue.history.push({
          queueItemId: session!.queue.nowPlaying.queueItemId,
          songId: session!.queue.nowPlaying.song.id,
          playedAt: Date.now(),
        })
      }
      advanceQueue()
      broadcastQueue()
    })

    socket.on('playback:play', () => {
      const np = session!.queue.nowPlaying
      if (np) {
        np.isPlaying = true
        np.startedAt = Date.now()
        io!.emit('playback:resumed', np.positionMs)
        onQueueUpdate?.(session!.queue)
      }
    })

    socket.on('playback:pause', () => {
      const np = session!.queue.nowPlaying
      if (np) {
        np.positionMs = Date.now() - np.startedAt + np.positionMs
        np.isPlaying = false
        io!.emit('playback:paused', np.positionMs)
        onQueueUpdate?.(session!.queue)
      }
    })

    socket.on('playback:seek', (positionMs) => {
      const np = session!.queue.nowPlaying
      if (np) {
        np.positionMs = positionMs
        np.startedAt = Date.now()
        io!.emit('playback:seeked', positionMs)
        onQueueUpdate?.(session!.queue)
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
  const qrDataUrl = await startDiscovery(session.id, PORT)

  return { sessionId: session.id, port: PORT, qrDataUrl }
}

export async function stopPartyServer(): Promise<void> {
  if (playbackTick) { clearInterval(playbackTick); playbackTick = null }
  await stopDiscovery()
  if (io) { io.close(); io = null }
  if (httpServer) { httpServer.close(); httpServer = null }
  session = null
}
