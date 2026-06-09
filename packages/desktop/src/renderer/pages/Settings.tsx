import React, { useState } from 'react'
import DevicePicker from '../components/DevicePicker'
import { useAppContext } from '../context/AppContext'

export default function Settings(): React.ReactElement {
  const { player } = useAppContext()
  const [outputDevice, setOutputDevice] = useState('')
  const [inputDevice, setInputDevice] = useState('')
  const [micStatus, setMicStatus] = useState<'idle' | 'granted' | 'denied'>('idle')
  const [chromecasts, setChromecasts] = useState<{ id: string; name: string; host: string; port: number }[]>([])
  const [scanning, setScanning] = useState(false)

  const applyOutput = async (id: string) => {
    setOutputDevice(id)
    if (id) await player.setOutputDevice(id)
  }

  const applyInput = async (id: string) => {
    setInputDevice(id)
    if (id) await player.setInputDevice(id)
  }

  const requestMic = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      setMicStatus('granted')
    } catch {
      setMicStatus('denied')
    }
  }

  const scanChromecast = async () => {
    setScanning(true)
    try {
      const devices = await (window as any).api.discoverChromecast()
      setChromecasts(devices)
    } finally {
      setScanning(false)
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 32 }}>
      <section>
        <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700, color: '#e05' }}>Audio Devices</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <DevicePicker
            type="audiooutput"
            label="Output device (speakers / HDMI / AirPlay)"
            selected={outputDevice}
            onChange={applyOutput}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <DevicePicker
              type="audioinput"
              label="Microphone input"
              selected={inputDevice}
              onChange={applyInput}
            />
            {micStatus === 'idle' && (
              <button onClick={requestMic} style={{ ...btnStyle, alignSelf: 'flex-start', fontSize: 12, padding: '5px 14px' }}>
                Grant microphone permission
              </button>
            )}
            {micStatus === 'granted' && (
              <span style={{ fontSize: 12, color: '#4a4' }}>✓ Microphone access granted</span>
            )}
            {micStatus === 'denied' && (
              <span style={{ fontSize: 12, color: '#e05' }}>✗ Microphone access denied — check system permissions</span>
            )}
          </div>
        </div>
      </section>

      <section>
        <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700, color: '#e05' }}>Casting</h3>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
          AirPlay: Select the AirPlay device from the Output Device dropdown above.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={scanChromecast} disabled={scanning} style={btnStyle}>
            {scanning ? 'Scanning...' : 'Scan for Chromecast'}
          </button>
        </div>
        {chromecasts.map((d) => (
          <div
            key={d.id}
            style={{
              marginTop: 8,
              padding: 10,
              background: '#1a1a1a',
              borderRadius: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{d.name}</span>
            <button
              onClick={() => (window as any).api.castToChromecast(d, 'http://localhost')}
              style={{ ...btnStyle, padding: '4px 12px', fontSize: 12 }}
            >
              Cast
            </button>
          </div>
        ))}
      </section>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  background: '#e05',
  border: 'none',
  color: '#fff',
  padding: '8px 18px',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 13,
}
