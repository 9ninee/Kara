import type { QueueState, QueueItem, NowPlaying } from './queue.js'
import type { Song } from './song.js'

export interface Participant {
  id: string
  name: string
  isHost: boolean
  joinedAt: number
}

export interface PartySession {
  id: string
  hostId: string
  participants: Participant[]
  queue: QueueState
  createdAt: number
}

// ---------------------------------------------------------------------------
// Socket.io event contracts (client ↔ server)
// ---------------------------------------------------------------------------

export interface ServerToClientEvents {
  'session:joined': (session: PartySession) => void
  'session:participant-joined': (participant: Participant) => void
  'session:participant-left': (participantId: string) => void
  'queue:updated': (queue: QueueState) => void
  'playback:started': (nowPlaying: NowPlaying) => void
  'playback:paused': (positionMs: number) => void
  'playback:resumed': (positionMs: number) => void
  'playback:ended': () => void
  'playback:seeked': (positionMs: number) => void
  error: (message: string) => void
}

export interface ClientToServerEvents {
  'session:join': (payload: { sessionId: string; name: string }) => void
  'queue:add': (song: Song) => void
  'queue:remove': (queueItemId: string) => void
  'queue:reorder': (fromIndex: number, toIndex: number) => void
  'queue:skip-vote': (queueItemId: string) => void
  'playback:play': () => void
  'playback:pause': () => void
  'playback:seek': (positionMs: number) => void
  'playback:next': () => void
}

export interface InterServerEvents {
  ping: () => void
}

export interface SocketData {
  participant: Participant
  sessionId: string
}
