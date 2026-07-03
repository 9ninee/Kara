import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import type {
  PartySession,
  ServerToClientEvents,
  ClientToServerEvents,
  Song,
} from '@kara/shared'

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>

/** Song as served by the host's /api/library — includes a streamable LAN URL */
export type HostSong = Song & { mediaUrl?: string }

export interface PartyContextValue {
  connected: boolean
  session: PartySession | null
  /** Live playback position of the host player (ms), from 1 Hz ticks */
  positionMs: number
  connect: (serverUrl: string, name: string) => Promise<void>
  disconnect: () => void
  addToQueue: (song: Song) => void
  removeFromQueue: (queueItemId: string) => void
  voteSkip: (queueItemId: string) => void
  next: () => void
  /** Fetch the host's song library over the party HTTP endpoint */
  fetchHostLibrary: () => Promise<HostSong[]>
}

const PartyContext = createContext<PartyContextValue>({
  connected: false,
  session: null,
  positionMs: 0,
  connect: async () => {},
  disconnect: () => {},
  addToQueue: () => {},
  removeFromQueue: () => {},
  voteSkip: () => {},
  next: () => {},
  fetchHostLibrary: async () => [],
})

export function PartyProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const socketRef = useRef<PartySocket | null>(null)
  const httpBaseRef = useRef<string>('')
  const [connected, setConnected] = useState(false)
  const [session, setSession] = useState<PartySession | null>(null)
  const [positionMs, setPositionMs] = useState(0)

  const teardown = useCallback(() => {
    socketRef.current?.removeAllListeners()
    socketRef.current?.disconnect()
    socketRef.current = null
    httpBaseRef.current = ''
    setConnected(false)
    setSession(null)
    setPositionMs(0)
  }, [])

  // Close the socket when the provider unmounts (app teardown)
  useEffect(() => teardown, [teardown])

  const connect = useCallback((serverUrl: string, name: string): Promise<void> => {
    // Normalize ws://host:port or bare host:port → http://host:port
    const httpBase = serverUrl.replace(/^ws/, 'http').replace(/\/$/, '')

    return new Promise((resolve, reject) => {
      socketRef.current?.removeAllListeners()
      socketRef.current?.disconnect()

      const socket: PartySocket = io(httpBase, { transports: ['websocket'] })
      let joinedOnce = false

      socket.on('connect', () => {
        socket.emit('session:join', { sessionId: '', name })
      })

      socket.on('session:joined', (s) => {
        joinedOnce = true
        httpBaseRef.current = httpBase
        setConnected(true)
        setSession(s)
        resolve()
      })

      socket.on('queue:updated', (queue) => {
        setSession((prev) => (prev ? { ...prev, queue } : prev))
      })

      socket.on('playback:tick', (ms) => setPositionMs(ms))
      socket.on('playback:seeked', (ms) => setPositionMs(ms))
      socket.on('playback:started', () => setPositionMs(0))

      socket.on('session:participant-joined', (participant) => {
        setSession((prev) =>
          prev ? { ...prev, participants: [...prev.participants, participant] } : prev,
        )
      })

      socket.on('session:participant-left', (id) => {
        setSession((prev) =>
          prev
            ? { ...prev, participants: prev.participants.filter((p) => p.id !== id) }
            : prev,
        )
      })

      socket.on('disconnect', () => {
        setConnected(false)
      })

      // socket.io reconnects automatically; flip state back when it succeeds
      socket.io.on('reconnect', () => {
        socket.emit('session:join', { sessionId: '', name })
        setConnected(true)
      })

      socket.on('connect_error', (err) => {
        // Only give up if the FIRST connection fails; later errors are
        // transient Wi-Fi blips that socket.io retries on its own.
        if (!joinedOnce) {
          socket.removeAllListeners()
          socket.disconnect()
          reject(err)
        }
      })

      socketRef.current = socket
    })
  }, [])

  const addToQueue = useCallback((song: Song) => {
    socketRef.current?.emit('queue:add', song)
  }, [])

  const removeFromQueue = useCallback((queueItemId: string) => {
    socketRef.current?.emit('queue:remove', queueItemId)
  }, [])

  const voteSkip = useCallback((queueItemId: string) => {
    socketRef.current?.emit('queue:skip-vote', queueItemId)
  }, [])

  const next = useCallback(() => {
    socketRef.current?.emit('playback:next')
  }, [])

  const fetchHostLibrary = useCallback(async (): Promise<HostSong[]> => {
    if (!httpBaseRef.current) return []
    const resp = await fetch(`${httpBaseRef.current}/api/library`)
    if (!resp.ok) throw new Error(`Host library request failed (${resp.status})`)
    return (await resp.json()) as HostSong[]
  }, [])

  return (
    <PartyContext.Provider
      value={{
        connected,
        session,
        positionMs,
        connect,
        disconnect: teardown,
        addToQueue,
        removeFromQueue,
        voteSkip,
        next,
        fetchHostLibrary,
      }}
    >
      {children}
    </PartyContext.Provider>
  )
}

export const useParty = (): PartyContextValue => useContext(PartyContext)
