import { useRef, useState, useCallback, useEffect } from 'react'

export interface MicState {
  active: boolean
  volume: number      // 0-1 music pass-through
  micGain: number     // 0-1 microphone gain
  reverbWet: number   // 0-1 reverb mix
  pitchSemitones: number // -6 to +6 key change (placeholder — needs SoundTouch)
  inputDeviceId: string
  outputDeviceId: string
  devices: MediaDeviceInfo[]
}

const DEFAULT: MicState = {
  active: false, volume: 1, micGain: 0.8, reverbWet: 0.3, pitchSemitones: 0,
  inputDeviceId: '', outputDeviceId: '', devices: [],
}

export function useMic() {
  const ctxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const micGainRef = useRef<GainNode | null>(null)
  const [state, setState] = useState<MicState>(DEFAULT)

  const enumerateDevices = useCallback(async () => {
    const all = await navigator.mediaDevices.enumerateDevices()
    setState(s => ({ ...s, devices: all }))
  }, [])

  useEffect(() => { enumerateDevices() }, [enumerateDevices])

  const start = useCallback(async (deviceId?: string) => {
    const ctx = new AudioContext()
    ctxRef.current = ctx

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: false, noiseSuppression: false },
    })
    streamRef.current = stream

    const source = ctx.createMediaStreamSource(stream)
    const micGain = ctx.createGain()
    micGain.gain.value = state.micGain
    micGainRef.current = micGain

    // Reverb via ConvolverNode (impulse response loaded from server if available)
    let reverb: ConvolverNode | null = null
    let reverbGain: GainNode | null = null
    let dryGain: GainNode | null = null
    try {
      const resp = await fetch('/api/ir/room.wav')
      if (resp.ok) {
        const buf = await resp.arrayBuffer()
        const irBuffer = await ctx.decodeAudioData(buf)
        reverb = ctx.createConvolver()
        reverb.buffer = irBuffer
        reverbGain = ctx.createGain()
        dryGain = ctx.createGain()
        reverbGain.gain.value = state.reverbWet
        dryGain.gain.value = 1 - state.reverbWet
        source.connect(micGain)
        micGain.connect(dryGain)
        micGain.connect(reverb)
        reverb.connect(reverbGain)
        dryGain.connect(ctx.destination)
        reverbGain.connect(ctx.destination)
      }
    } catch { /* no IR available */ }

    if (!reverb) {
      source.connect(micGain)
      micGain.connect(ctx.destination)
    }

    await enumerateDevices()
    setState(s => ({ ...s, active: true, inputDeviceId: deviceId ?? '' }))
  }, [state.micGain, state.reverbWet, enumerateDevices])

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    ctxRef.current?.close()
    streamRef.current = null
    ctxRef.current = null
    setState(s => ({ ...s, active: false }))
  }, [])

  const setMicGain = useCallback((v: number) => {
    if (micGainRef.current) micGainRef.current.gain.value = v
    setState(s => ({ ...s, micGain: v }))
  }, [])

  return { state, start, stop, setMicGain, enumerateDevices }
}
