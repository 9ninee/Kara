import { useRef, useState, useCallback, useEffect } from 'react'

export interface PlayerState {
  isPlaying: boolean
  currentTimeMs: number
  durationMs: number
  volume: number
  micVolume: number
}

export interface AudioPlayer {
  state: PlayerState
  loadTrack: (audioUrl: string) => Promise<void>
  play: () => void
  pause: () => void
  seek: (ms: number) => void
  setVolume: (vol: number) => void
  setMicVolume: (vol: number) => void
  setOutputDevice: (deviceId: string) => Promise<void>
  setInputDevice: (deviceId: string) => Promise<void>
}

export function useAudioPlayer(): AudioPlayer {
  const ctxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const musicGainRef = useRef<GainNode | null>(null)
  const micGainRef = useRef<GainNode | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const bufferRef = useRef<AudioBuffer | null>(null)
  const startedAtRef = useRef(0)
  const pausedAtRef = useRef(0)
  const rafRef = useRef<number>(0)

  const [state, setState] = useState<PlayerState>({
    isPlaying: false,
    currentTimeMs: 0,
    durationMs: 0,
    volume: 1,
    micVolume: 0.8,
  })

  function getContext(): AudioContext {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext()
      musicGainRef.current = ctxRef.current.createGain()
      micGainRef.current = ctxRef.current.createGain()
      masterGainRef.current = ctxRef.current.createGain()
      musicGainRef.current.connect(masterGainRef.current)
      micGainRef.current.connect(masterGainRef.current)
      masterGainRef.current.connect(ctxRef.current.destination)
    }
    return ctxRef.current
  }

  const tickRaf = useCallback(() => {
    if (!ctxRef.current || !sourceRef.current) return
    const elapsed = (ctxRef.current.currentTime - startedAtRef.current) * 1000 + pausedAtRef.current
    setState((s) => ({ ...s, currentTimeMs: Math.max(0, elapsed) }))
    rafRef.current = requestAnimationFrame(tickRaf)
  }, [])

  const loadTrack = useCallback(async (audioUrl: string) => {
    const ctx = getContext()
    if (sourceRef.current) {
      sourceRef.current.stop()
      sourceRef.current.disconnect()
      sourceRef.current = null
    }
    cancelAnimationFrame(rafRef.current)
    pausedAtRef.current = 0

    const resp = await fetch(audioUrl)
    const arrayBuffer = await resp.arrayBuffer()
    bufferRef.current = await ctx.decodeAudioData(arrayBuffer)
    setState((s) => ({ ...s, durationMs: bufferRef.current!.duration * 1000, currentTimeMs: 0, isPlaying: false }))
  }, [])

  const play = useCallback(() => {
    if (!bufferRef.current || !ctxRef.current) return
    if (sourceRef.current) {
      sourceRef.current.stop()
      sourceRef.current.disconnect()
    }
    const src = ctxRef.current.createBufferSource()
    src.buffer = bufferRef.current
    src.connect(musicGainRef.current!)
    src.start(0, pausedAtRef.current / 1000)
    src.onended = () => {
      if (sourceRef.current === src) {
        cancelAnimationFrame(rafRef.current)
        pausedAtRef.current = 0
        setState((s) => ({ ...s, isPlaying: false, currentTimeMs: s.durationMs }))
      }
    }
    sourceRef.current = src
    startedAtRef.current = ctxRef.current.currentTime
    setState((s) => ({ ...s, isPlaying: true }))
    rafRef.current = requestAnimationFrame(tickRaf)
  }, [tickRaf])

  const pause = useCallback(() => {
    if (!sourceRef.current || !ctxRef.current) return
    pausedAtRef.current += (ctxRef.current.currentTime - startedAtRef.current) * 1000
    sourceRef.current.stop()
    sourceRef.current = null
    cancelAnimationFrame(rafRef.current)
    setState((s) => ({ ...s, isPlaying: false }))
  }, [])

  const seek = useCallback(
    (ms: number) => {
      pausedAtRef.current = ms
      const wasPlaying = !!sourceRef.current
      if (wasPlaying) {
        if (sourceRef.current) {
          sourceRef.current.stop()
          sourceRef.current = null
        }
        play()
      } else {
        setState((s) => ({ ...s, currentTimeMs: ms }))
      }
    },
    [play],
  )

  const setVolume = useCallback((vol: number) => {
    if (masterGainRef.current) masterGainRef.current.gain.value = vol
    setState((s) => ({ ...s, volume: vol }))
  }, [])

  const setMicVolume = useCallback((vol: number) => {
    if (micGainRef.current) micGainRef.current.gain.value = vol
    setState((s) => ({ ...s, micVolume: vol }))
  }, [])

  const setOutputDevice = useCallback(async (deviceId: string) => {
    const ctx = getContext()
    if ('setSinkId' in ctx) {
      await (ctx as AudioContext & { setSinkId: (id: string) => Promise<void> }).setSinkId(deviceId)
    }
  }, [])

  const setInputDevice = useCallback(async (deviceId: string) => {
    const ctx = getContext()
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop())
      micStreamRef.current = null
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId } })
      micStreamRef.current = stream
      const src = ctx.createMediaStreamSource(stream)
      src.connect(micGainRef.current!)
    } catch (err: unknown) {
      console.warn('[useAudioPlayer] setInputDevice failed', err)
    }
  }, [])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  return { state, loadTrack, play, pause, seek, setVolume, setMicVolume, setOutputDevice, setInputDevice }
}
