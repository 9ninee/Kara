import React, { useState, useEffect } from 'react'
import DevicePicker from '../components/DevicePicker'
import { useAudioPlayer } from '../hooks/useAudioPlayer'

interface ChromecastDevice {
  id: string
  name: string
  host: string
  port: number
}

export default function Settings(): React.ReactElement {
  const player = useAudioPlayer()
  const [outputDevice, setOutputDevice] = useState('')
  const [inputDevice, setInputDevice] = useState('')

  // Chromecast state
  const [chromecasts, setChromecasts] = useState<ChromecastDevice[]>([])
  const [scanning, setScanning] = useState(false)
  const [castConnected, setCastConnected] = useState(false)
  const [castDevice, setCastDevice] = useState<ChromecastDevice | null>(null)
  const [castStatus, setCastStatus] = useState('')

  // Karaoke API state
  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiName, setApiName] = useState('')
  const [apiConfigured, setApiConfigured] = useState(false)
  const [apiSaving, setApiSaving] = useState(false)

  useEffect(() => {
    // Load cast status on mount
    ;(window as any).api.getCastStatus().then((s: { connected: boolean; device: ChromecastDevice | null }) => {
      setCastConnected(s.connected)
      setCastDevice(s.device ?? null)
    })
    // Load API status
    ;(window as any).api.getKaraokeApiStatus().then((s: { configured: boolean; name: string | null }) => {
      setApiConfigured(s.configured)
      if (s.name) setApiName(s.name)
    })
  }, [])

  const applyOutput = async (id: string) => {
    setOutputDevice(id)
    if (id) await player.setOutputDevice(id)
    await (window as any).api.setOutputDevice(id)
  }

  const applyInput = async (id: string) => {
    setInputDevice(id)
    if (id) await player.setInputDevice(id)
    await (window as any).api.setInputDevice(id)
  }

  const scanChromecast = async () => {
    setScanning(true)
    try {
      const devices: ChromecastDevice[] = await (window as any).api.discoverChromecast()
      setChromecasts(devices)
      if (devices.length === 0) setCastStatus('No Chromecast devices found.')
    } finally {
      setScanning(false)
    }
  }

  const castTo = async (device: ChromecastDevice) => {
    setCastStatus(`Connecting to ${device.name}…`)
    const result = await (window as any).api.castToChromecast(device, '') as { success: boolean; error?: string }
    if (result.success) {
      setCastConnected(true)
      setCastDevice(device)
      setCastStatus(`Casting to ${device.name}`)
    } else {
      setCastStatus(`Cast failed: ${result.error}`)
    }
  }

  const stopCast = async () => {
    await (window as any).api.stopCasting()
    setCastConnected(false)
    setCastDevice(null)
    setCastStatus('')
  }

  const saveApiConfig = async () => {
    if (!apiBaseUrl.trim() || !apiKey.trim()) return
    setApiSaving(true)
    try {
      await (window as any).api.configureKaraokeApi(apiBaseUrl.trim(), apiKey.trim(), apiName.trim() || 'Karaoke API')
      setApiConfigured(true)
    } finally {
      setApiSaving(false)
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 32, overflowY: 'auto' }}>

      {/* Audio Devices */}
      <section>
        <h3 style={sectionTitle}>Audio Devices</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <DevicePicker type="audiooutput" label="Output device (speakers / HDMI / AirPlay)" selected={outputDevice} onChange={applyOutput} />
          <DevicePicker type="audioinput" label="Microphone input" selected={inputDevice} onChange={applyInput} />

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ color: '#aaa', minWidth: 80 }}>Mic volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={player.state.micVolume}
              onChange={(e) => player.setMicVolume(Number(e.target.value))}
              style={{ accentColor: '#4af', flex: 1 }}
            />
            <span style={{ color: '#666', fontSize: 12, minWidth: 36 }}>
              {Math.round(player.state.micVolume * 100)}%
            </span>
          </label>
        </div>
        <p style={{ fontSize: 12, color: '#555', marginTop: 8 }}>
          AirPlay: select the AirPlay device from the Output Device dropdown above (macOS exposes AirPlay as an audio output).
        </p>
      </section>

      {/* Chromecast */}
      <section>
        <h3 style={sectionTitle}>Chromecast</h3>
        {castConnected && castDevice ? (
          <div style={{ background: '#0a1a0a', border: '1px solid #0a3a0a', borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div style={{ color: '#4f4', fontWeight: 600, marginBottom: 4 }}>Casting to {castDevice.name}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => (window as any).api.castPause()} style={btnSmall}>Pause</button>
              <button onClick={() => (window as any).api.castResume()} style={btnSmall}>Resume</button>
              <button onClick={stopCast} style={{ ...btnSmall, background: '#422' }}>Stop Cast</button>
            </div>
          </div>
        ) : (
          <>
            <button onClick={scanChromecast} disabled={scanning} style={btnPrimary}>
              {scanning ? 'Scanning…' : 'Scan for Chromecast devices'}
            </button>
            {castStatus && <p style={{ fontSize: 13, color: '#888', marginTop: 8 }}>{castStatus}</p>}
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {chromecasts.map((d) => (
                <div key={d.id} style={{ background: '#1a1a1a', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>{d.host}</div>
                  </div>
                  <button onClick={() => castTo(d)} style={{ ...btnSmall, padding: '6px 14px' }}>Cast</button>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Karaoke API */}
      <section>
        <h3 style={sectionTitle}>Karaoke API</h3>
        {apiConfigured && (
          <div style={{ background: '#0a1a1a', border: '1px solid #0a2a2a', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#4af' }}>
            {apiName || 'API'} configured
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            placeholder="Base URL (e.g. https://api.karaoke-version.com)"
            style={inputStyle}
          />
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="API key"
            type="password"
            style={inputStyle}
          />
          <input
            value={apiName}
            onChange={(e) => setApiName(e.target.value)}
            placeholder="Provider name (optional)"
            style={inputStyle}
          />
          <button onClick={saveApiConfig} disabled={apiSaving || !apiBaseUrl || !apiKey} style={btnPrimary}>
            {apiSaving ? 'Saving…' : 'Save API Config'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: '#555', marginTop: 8 }}>
          Connect a third-party karaoke track service. The API must return JSON with a <code>tracks</code> or <code>results</code> array.
        </p>
      </section>

    </div>
  )
}

const sectionTitle: React.CSSProperties = {
  marginBottom: 16,
  fontSize: 14,
  fontWeight: 700,
  color: '#e05',
  textTransform: 'uppercase',
  letterSpacing: 1,
}

const btnPrimary: React.CSSProperties = {
  background: '#e05',
  border: 'none',
  color: '#fff',
  padding: '8px 18px',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 13,
}

const btnSmall: React.CSSProperties = {
  background: '#333',
  border: 'none',
  color: '#fff',
  padding: '5px 10px',
  borderRadius: 6,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 12,
}

const inputStyle: React.CSSProperties = {
  background: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: 6,
  color: '#fff',
  padding: '8px 12px',
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box',
}
