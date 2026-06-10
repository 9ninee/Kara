import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

export interface PlaybackState {
  songId: string | null
  positionMs: number
  isPlaying: boolean
  duration: number // seconds
}

export interface QueueItem {
  id: string
  song: { id: string; title: string; artist: string; format: string; duration: number }
  singerName: string
  skipVotes: string[]
}

export interface QueueState {
  items: QueueItem[]
  nowPlaying: { item: QueueItem; positionMs: number; isPlaying: boolean } | null
  history: QueueItem[]
}

export interface AppState {
  queue: QueueState
  playback: PlaybackState
  connectedCount: number
}

const DEFAULT_STATE: AppState = {
  queue: { items: [], nowPlaying: null, history: [] },
  playback: { songId: null, positionMs: 0, isPlaying: false, duration: 0 },
  connectedCount: 1,
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const [state, setState] = useState<AppState>(DEFAULT_STATE)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const socket = io({ transports: ['websocket'] })
    socketRef.current = socket

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('state', (s: Partial<AppState>) => {
      setState(prev => ({ ...prev, ...s, connectedCount: s.connectedCount ?? prev.connectedCount }))
    })
    socket.on('tick', ({ positionMs }: { positionMs: number }) => {
      setState(prev => ({
        ...prev,
        playback: { ...prev.playback, positionMs },
        queue: prev.queue.nowPlaying
          ? { ...prev.queue, nowPlaying: { ...prev.queue.nowPlaying, positionMs } }
          : prev.queue,
      }))
    })

    return () => { socket.disconnect() }
  }, [])

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data)
  }, [])

  return { state, connected, emit }
}
