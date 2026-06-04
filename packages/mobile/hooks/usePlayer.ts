import { useState, useRef, useCallback } from 'react'
import { Audio, AVPlaybackStatus } from 'expo-av'
import { parseLRC, getCurrentLineIndex } from '@kara/shared'
import type { Song, LyricsLine } from '@kara/shared'

export interface MobilePlayerState {
  song: Song | null
  isPlaying: boolean
  currentTimeMs: number
  durationMs: number
  musicVolume: number
  micVolume: number
  lrcLines: LyricsLine[]
}

export interface MobilePlayer {
  state: MobilePlayerState
  loadSong: (song: Song) => Promise<void>
  play: () => Promise<void>
  pause: () => Promise<void>
  seek: (ms: number) => Promise<void>
  setMusicVolume: (v: number) => void
  setMicVolume: (v: number) => void
}

export function usePlayer(): MobilePlayer {
  const soundRef = useRef<Audio.Sound | null>(null)
  const [state, setState] = useState<MobilePlayerState>({
    song: null,
    isPlaying: false,
    currentTimeMs: 0,
    durationMs: 0,
    musicVolume: 1,
    micVolume: 0.8,
    lrcLines: [],
  })

  const onPlaybackStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return
    setState((s) => ({
      ...s,
      isPlaying: status.isPlaying,
      currentTimeMs: status.positionMillis,
      durationMs: status.durationMillis ?? 0,
    }))
  }, [])

  const loadSong = useCallback(
    async (song: Song) => {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      })

      if (soundRef.current) {
        await soundRef.current.unloadAsync()
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: song.audioPath },
        { shouldPlay: false, volume: state.musicVolume },
        onPlaybackStatus,
      )
      soundRef.current = sound

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
      }))
    },
    [onPlaybackStatus, state.musicVolume],
  )

  const play = useCallback(async () => {
    await soundRef.current?.playAsync()
  }, [])

  const pause = useCallback(async () => {
    await soundRef.current?.pauseAsync()
  }, [])

  const seek = useCallback(async (ms: number) => {
    await soundRef.current?.setPositionAsync(ms)
  }, [])

  const setMusicVolume = useCallback((v: number) => {
    soundRef.current?.setVolumeAsync(v)
    setState((s) => ({ ...s, musicVolume: v }))
  }, [])

  const setMicVolume = useCallback((v: number) => {
    setState((s) => ({ ...s, micVolume: v }))
  }, [])

  return { state, loadSong, play, pause, seek, setMusicVolume, setMicVolume }
}
