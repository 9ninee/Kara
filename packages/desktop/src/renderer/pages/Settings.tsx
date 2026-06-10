import React, { useState } from 'react'
import DevicePicker from '../components/DevicePicker'
import { useAppContext } from '../context/AppContext'

export default function Settings(): React.ReactElement {
  const { player, currentSong } = useAppContext()
  const [outputDevice, setOutputDevice] = useState('')
  const [inputDevice, setInputDevice] = useState('')
  const [micStatus, setMicStatus] = useState<'idle' | 'granted' | 'denied'>('idle')
  const [chromecasts, setChromecasts] = useState<{ id: string; name: string; host: string; port: number }[]>([])
  const [scanning, setScanning] = useState(false)
  const [castStatus, setCastStatus] = useState<string | null>(null)
  const [apiBaseUrl, setApiBaseUrl] = useState(() => localStorage.getItem('kara:apiBaseUrl') ?? '')
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('kara:apiKey') ?? '')
  const [apiSaved, setApiSaved] = useState(false)

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
        <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700, color: '#e05' }}>Online Karaoke API</h3>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
          Connect to a karaoke platform's REST API. Results appear in Library → Search Online → Karaoke API tab.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontSize: 13, color: '#aaa' }}>
            Base URL
            <input
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="https://api.karaoke-service.com/v1"
              style={{ ...inputStyle, display: 'block', marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 13, color: '#aaa' }}>
            API Key
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="your-api-key"
              style={{ ...inputStyle, display: 'block', marginTop: 4 }}
            />
          </label>
          <button
            onClick={async () => {
              localStorage.setItem('kara:apiBaseUrl', apiBaseUrl)
              localStorage.setItem('kara:apiKey', apiKey)
              await (window as any).api.configureKaraokeApi(apiBaseUrl, apiKey)
              setApiSaved(true)
              setTimeout(() => setApiSaved(false), 2000)
            }}
            style={{ ...btnStyle, alignSelf: 'flex-start' }}
          >
            {apiSaved ? '✓ Saved' : 'Save'}
          </button>
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
        {castStatus && (
          <div style={{ marginTop: 8, fontSize: 12, color: castStatus.startsWith('Error') ? '#e05' : '#4af' }}>
            {castStatus}
          </div>
        )}
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
              onClick={async () => {
                if (!currentSong) { setCastStatus('No song loaded'); return }
                setCastStatus('Casting…')
                const result = await (window as any).api.castToChromecast(d, currentSong.audioPath)
                setCastStatus(result.success ? `Casting to ${d.name}` : `Error: ${result.error}`)
              }}
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: 6,
  color: '#fff',
  padding: '7px 10px',
  fontSize: 13,
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
