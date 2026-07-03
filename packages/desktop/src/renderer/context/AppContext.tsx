import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { CDGPlayer, parseLRC } from '@kara/shared'
import type { Song, LyricsLine } from '@kara/shared'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import type { AudioPlayer } from '../hooks/useAudioPlayer'

interface AppContextValue {
  currentSong: Song | null
  /** Load a song into the player and switch to the player page */
  playSong: (song: Song, autoPlay?: boolean) => void
  /** Page navigation request — App.tsx consumes this and resets to null */
  requestedPage: string | null
  clearRequestedPage: () => void
  /** The one shared audio pipeline (Settings + Player operate on the same graph) */
  player: AudioPlayer
  cdgPlayer: CDGPlayer | null
  lrcLines: LyricsLine[]
  songLoading: boolean
}

const noopPlayer = {} as AudioPlayer

const AppContext = createContext<AppContextValue>({
  currentSong: null,
  playSong: () => {},
  requestedPage: null,
  clearRequestedPage: () => {},
  player: noopPlayer,
  cdgPlayer: null,
  lrcLines: [],
  songLoading: false,
})

export function AppProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [currentSong, setCurrentSong] = useState<Song | null>(null)
  const [requestedPage, setRequestedPage] = useState<string | null>(null)
  const [cdgPlayer, setCdgPlayer] = useState<CDGPlayer | null>(null)
  const [lrcLines, setLrcLines] = useState<LyricsLine[]>([])
  const [songLoading, setSongLoading] = useState(false)
  const loadSeqRef = useRef(0)

  // When a song finishes naturally, advance the party queue (no-op when no party)
  const player = useAudioPlayer(() => {
    window.api.partyNext().catch(() => undefined)
  })
  const playerRef = useRef(player)
  playerRef.current = player

  const playSong = useCallback((song: Song, autoPlay = false) => {
    setCurrentSong(song)
    setRequestedPage('player')
    const seq = ++loadSeqRef.current
    setSongLoading(true)
    ;(async () => {
      try {
        const audioUrl = window.api.getLocalFileUrl(song.audioPath)
        await playerRef.current.loadTrack(audioUrl)
        if (seq !== loadSeqRef.current) return // superseded by a newer playSong

        if (song.cdgPath) {
          const resp = await fetch(window.api.getLocalFileUrl(song.cdgPath))
          const buf = await resp.arrayBuffer()
          if (seq !== loadSeqRef.current) return
          setCdgPlayer(new CDGPlayer(buf))
          setLrcLines([])
        } else if (song.lrcPath) {
          const resp = await fetch(window.api.getLocalFileUrl(song.lrcPath))
          const text = await resp.text()
          if (seq !== loadSeqRef.current) return
          setCdgPlayer(null)
          setLrcLines(parseLRC(text))
        } else {
          setCdgPlayer(null)
          setLrcLines([])
        }

        if (autoPlay) playerRef.current.play()
        window.api.songPlayed(song.id).catch(() => undefined)
      } catch (err: unknown) {
        console.error('[AppContext] failed to load song', err)
        if (seq === loadSeqRef.current) {
          setCurrentSong(null)
          setCdgPlayer(null)
          setLrcLines([])
        }
      } finally {
        if (seq === loadSeqRef.current) setSongLoading(false)
      }
    })()
  }, [])

  const playSongRef = useRef(playSong)
  playSongRef.current = playSong

  // Party mode: main process pushes the next song when the queue advances
  useEffect(() => {
    const unsub = window.api.on('party:play-song', (song) => {
      playSongRef.current(song as Song, true)
    })
    return () => { unsub() }
  }, [])

  const clearRequestedPage = useCallback(() => setRequestedPage(null), [])

  return (
    <AppContext.Provider
      value={{ currentSong, playSong, requestedPage, clearRequestedPage, player, cdgPlayer, lrcLines, songLoading }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useAppContext = (): AppContextValue => useContext(AppContext)
