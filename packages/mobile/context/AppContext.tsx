import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio'
import { parseLRC } from '@kara/shared'
import type { Song, LyricsLine } from '@kara/shared'

export interface PlayerState {
  song: Song | null
  isPlaying: boolean
  currentTimeMs: number
  durationMs: number
  musicVolume: number
  micVolume: number
  lrcLines: LyricsLine[]
  loading: boolean
}

export interface AppContextValue {
  playerState: PlayerState
  playSong: (song: Song) => Promise<void>
  play: () => Promise<void>
  pause: () => Promise<void>
  seek: (ms: number) => Promise<void>
  setMusicVolume: (v: number) => void
  setMicVolume: (v: number) => void
}

const defaultState: PlayerState = {
  song: null,
  isPlaying: false,
  currentTimeMs: 0,
  durationMs: 0,
  musicVolume: 1,
  micVolume: 0.8,
  lrcLines: [],
  loading: false,
}

const AppContext = createContext<AppContextValue>({
  playerState: defaultState,
  playSong: async () => {},
  play: async () => {},
  pause: async () => {},
  seek: async () => {},
  setMusicVolume: () => {},
  setMicVolume: () => {},
})

export function AppProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const player = useAudioPlayer(null)
  const status = useAudioPlayerStatus(player)
  const [state, setState] = useState<PlayerState>(defaultState)
  const finishedRef = useRef(false)

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true,
      shouldPlayInBackground: true,
    }).catch(() => undefined)
  }, [])

  // Mirror the player's status into our state. expo-audio does not rewind
  // automatically when a song finishes — seek back so Play restarts cleanly.
  useEffect(() => {
    if (status.didJustFinish && !finishedRef.current) {
      finishedRef.current = true
      // pause BEFORE rewinding — on Android the player may still have
      // playWhenReady set, and a bare seekTo(0) would loop the song forever
      player.pause()
      player.seekTo(0).catch(() => undefined)
      setState((s) => ({ ...s, isPlaying: false, currentTimeMs: 0 }))
      return
    }
    if (!status.didJustFinish) finishedRef.current = false
    setState((s) => ({
      ...s,
      isPlaying: status.playing,
      currentTimeMs: Math.round((status.currentTime ?? 0) * 1000),
      durationMs: Math.round((status.duration ?? 0) * 1000),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.playing, status.currentTime, status.duration, status.didJustFinish])

  const playSong = useCallback(
    async (song: Song) => {
      setState((s) => ({ ...s, loading: true, song }))
      try {
        // replace() keeps the previous playing state — pause first so a new
        // song always loads stopped and the user presses Play deliberately
        player.pause()
        player.replace({ uri: song.audioPath })

        let lrcLines: LyricsLine[] = []
        if (song.lrcPath) {
          const resp = await fetch(song.lrcPath)
          const text = await resp.text()
          lrcLines = parseLRC(text)
        }

        setState((s) => ({
          ...s,
          song,
          isPlaying: false,
          currentTimeMs: 0,
          lrcLines,
          loading: false,
        }))
      } catch (err: unknown) {
        console.warn('[AppContext] playSong failed', err)
        setState((s) => ({ ...s, song: null, loading: false, isPlaying: false, lrcLines: [] }))
      }
    },
    [player],
  )

  const play = useCallback(async () => {
    player.play()
  }, [player])

  const pause = useCallback(async () => {
    player.pause()
  }, [player])

  const seek = useCallback(
    async (ms: number) => {
      await player.seekTo(ms / 1000).catch(() => undefined)
    },
    [player],
  )

  const setMusicVolume = useCallback(
    (v: number) => {
      player.volume = v
      setState((s) => ({ ...s, musicVolume: v }))
    },
    [player],
  )

  const setMicVolume = useCallback((v: number) => {
    setState((s) => ({ ...s, micVolume: v }))
  }, [])

  return (
    <AppContext.Provider value={{ playerState: state, playSong, play, pause, seek, setMusicVolume, setMicVolume }}>
      {children}
    </AppContext.Provider>
  )
}

export const useAppContext = (): AppContextValue => useContext(AppContext)
