import { useState, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import type {
  PartySession,
  ServerToClientEvents,
  ClientToServerEvents,
} from '@kara/shared'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>

export interface PartyState {
  connected: boolean
  session: PartySession | null
}

export interface PartyControls {
  connected: boolean
  session: PartySession | null
  connect: (serverUrl: string, name: string) => Promise<void>
  disconnect: () => void
}

export function useParty(): PartyControls {
  const socketRef = useRef<PartySocket | null>(null)
  const [state, setState] = useState<PartyState>({ connected: false, session: null })

  const connect = useCallback((serverUrl: string, name: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const socket: PartySocket = io(serverUrl, { transports: ['websocket'] })

      socket.on('connect', () => {
        socket.emit('session:join', { sessionId: '', name })
      })

      socket.on('session:joined', (session) => {
        setState({ connected: true, session })
        resolve()
      })

      socket.on('queue:updated', (queue) => {
        setState((s) =>
          s.session ? { ...s, session: { ...s.session, queue } } : s,
        )
      })

      socket.on('session:participant-joined', (participant) => {
        setState((s) =>
          s.session
            ? { ...s, session: { ...s.session, participants: [...s.session.participants, participant] } }
            : s,
        )
      })

      socket.on('session:participant-left', (id) => {
        setState((s) =>
          s.session
            ? { ...s, session: { ...s.session, participants: s.session.participants.filter((p) => p.id !== id) } }
            : s,
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
    setState({ connected: false, session: null })
  }, [])

  return { ...state, connect, disconnect }
}
