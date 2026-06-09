import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { Song } from '@kara/shared'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import type { AudioPlayer } from '../hooks/useAudioPlayer'

interface AppContextValue {
  currentSong: Song | null
  playSong: (song: Song) => void
  requestedPage: string | null
  clearRequestedPage: () => void
  player: AudioPlayer
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [currentSong, setCurrentSong] = useState<Song | null>(null)
  const [requestedPage, setRequestedPage] = useState<string | null>(null)
  const player = useAudioPlayer()

  const playSong = useCallback((song: Song) => {
    setCurrentSong(song)
    setRequestedPage('player')
  }, [])

  const clearRequestedPage = useCallback(() => setRequestedPage(null), [])

  return (
    <AppContext.Provider value={{ currentSong, playSong, requestedPage, clearRequestedPage, player }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider')
  return ctx
}
