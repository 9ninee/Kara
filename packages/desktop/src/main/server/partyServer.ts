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
  Participant,
} from '@kara/shared'

let httpServer: ReturnType<typeof createServer> | null = null
let io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null =
  null
let session: PartySession | null = null
let cachedQr = ''

const HOST_ID = 'host'
const PORT = 3000

function emptyQueue(): QueueState {
  return { items: [], nowPlaying: null, history: [] }
}

export async function startPartyServer(): Promise<{ sessionId: string; port: number; qr: string }> {
  if (io) return { sessionId: session!.id, port: PORT, qr: cachedQr }

  session = {
    id: randomUUID(),
    hostId: HOST_ID,
    participants: [],
    queue: emptyQueue(),
    createdAt: Date.now(),
  }

  httpServer = createServer((req, res) => {
    if (req.url === '/api/library' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(getSongs()))
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  io = new Server(httpServer, {
    cors: { origin: '*' },
  })

  io.on('connection', (socket) => {
    socket.on('session:join', ({ name }) => {
      const participant: Participant = {
        id: socket.id,
        name,
        isHost: false,
        joinedAt: Date.now(),
      }
      socket.data.participant = participant
      socket.data.sessionId = session!.id
      session!.participants.push(participant)

      socket.emit('session:joined', session!)
      socket.broadcast.emit('session:participant-joined', participant)
    })

    socket.on('queue:add', (song) => {
      const item = {
        id: randomUUID(),
        song,
        requestedBy: socket.data.participant?.name ?? 'Guest',
        addedAt: Date.now(),
        skipVotes: [],
      }
      session!.queue.items.push(item)
      io!.emit('queue:updated', session!.queue)
    })

    socket.on('queue:remove', (queueItemId) => {
      session!.queue.items = session!.queue.items.filter((i) => i.id !== queueItemId)
      io!.emit('queue:updated', session!.queue)
    })

    socket.on('queue:skip-vote', (queueItemId) => {
      const item = session!.queue.items.find((i) => i.id === queueItemId)
      if (item && !item.skipVotes.includes(socket.id)) {
        item.skipVotes.push(socket.id)
        io!.emit('queue:updated', session!.queue)
      }
    })

    socket.on('playback:play', () => {
      if (session!.queue.nowPlaying) {
        session!.queue.nowPlaying.isPlaying = true
        io!.emit('playback:resumed', session!.queue.nowPlaying.positionMs)
      }
    })

    socket.on('playback:pause', () => {
      if (session!.queue.nowPlaying) {
        session!.queue.nowPlaying.isPlaying = false
        io!.emit('playback:paused', session!.queue.nowPlaying.positionMs)
      }
    })

    socket.on('disconnect', () => {
      session!.participants = session!.participants.filter((p) => p.id !== socket.id)
      io!.emit('session:participant-left', socket.id)
    })
  })

  await new Promise<void>((resolve) => httpServer!.listen(PORT, resolve))
  cachedQr = await startDiscovery(session.id, PORT)

  return { sessionId: session.id, port: PORT, qr: cachedQr }
}

export async function stopPartyServer(): Promise<void> {
  await stopDiscovery()
  if (io) {
    io.close()
    io = null
  }
  if (httpServer) {
    httpServer.close()
    httpServer = null
  }
  session = null
  cachedQr = ''
}
