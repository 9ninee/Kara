import { useState, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import type {
  PartySession,
  ServerToClientEvents,
  ClientToServerEvents,
  Song,
} from '@kara/shared'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>

export interface PartyControls {
  connected: boolean
  session: PartySession | null
  connect: (serverUrl: string, name: string) => Promise<void>
  disconnect: () => void
  addSong: (song: Song) => void
  removeSong: (queueItemId: string) => void
  skipVote: (queueItemId: string) => void
}

export function useParty(): PartyControls {
  const socketRef = useRef<PartySocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [session, setSession] = useState<PartySession | null>(null)

  const connect = useCallback((serverUrl: string, name: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const socket: PartySocket = io(serverUrl, { transports: ['websocket'] })

      socket.on('connect', () => {
        socket.emit('session:join', { sessionId: '', name })
      })

      socket.on('session:joined', (s) => {
        setConnected(true)
        setSession(s)
        resolve()
      })

      socket.on('queue:updated', (queue) => {
        setSession((s) => (s ? { ...s, queue } : s))
      })

      socket.on('session:participant-joined', (participant) => {
        setSession((s) =>
          s ? { ...s, participants: [...s.participants, participant] } : s,
        )
      })

      socket.on('session:participant-left', (id) => {
        setSession((s) =>
          s ? { ...s, participants: s.participants.filter((p) => p.id !== id) } : s,
        )
      })

      socket.on('connect_error', (err) => {
        reject(err)
        socket.disconnect()
      })

      socketRef.current = socket
    })
  }, [])

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect()
    socketRef.current = null
    setConnected(false)
    setSession(null)
  }, [])

  const addSong = useCallback((song: Song) => {
    socketRef.current?.emit('queue:add', song)
  }, [])

  const removeSong = useCallback((queueItemId: string) => {
    socketRef.current?.emit('queue:remove', queueItemId)
  }, [])

  const skipVote = useCallback((queueItemId: string) => {
    socketRef.current?.emit('queue:skip-vote', queueItemId)
  }, [])

  return { connected, session, connect, disconnect, addSong, removeSong, skipVote }
}
