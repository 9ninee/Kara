import React, { useState, useEffect } from 'react'
import type { MicState } from '../hooks/useMic'

interface Props {
  mic: MicState
  onStartMic: (deviceId?: string) => void
  onStopMic: () => void
  onSetMicGain: (v: number) => void
}

export default function Settings({ mic, onStartMic, onStopMic, onSetMicGain }: Props) {
  const [folderPath, setFolderPath] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState('')
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedOutput, setSelectedOutput] = useState('')

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setOutputDevices(devices.filter(d => d.kind === 'audiooutput'))
    })
  }, [])

  const scanFolder = async () => {
    if (!folderPath.trim()) return
    setScanning(true)
    setScanMsg('')
    try {
      const r = await fetch('/api/library/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderPath }),
      })
      const d = await r.json()
      setScanMsg(r.ok ? `Scanned: ${d.added ?? 0} songs added` : `Error: ${d.error}`)
    } catch { setScanMsg('Network error') }
    finally { setScanning(false) }
  }

  const inputDevices = mic.devices.filter(d => d.kind === 'audioinput')

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '16px 20px', maxWidth: 560 }}>
      {/* Library */}
      <Section title="Song Library">
        <Row label="Scan folder">
          <input
            value={folderPath}
            onChange={e => setFolderPath(e.target.value)}
            placeholder="/path/to/karaoke/songs"
            style={inputSt}
          />
          <button onClick={scanFolder} disabled={scanning} style={btn}>
            {scanning ? '…' : 'Scan'}
          </button>
        </Row>
        {scanMsg && <div style={{ marginTop: 6, fontSize: 12, color: scanMsg.startsWith('Error') ? '#c44' : '#4c8' }}>{scanMsg}</div>}
        <div style={{ marginTop: 8, fontSize: 11, color: '#555' }}>
          Supported formats: CDG+MP3, MKV (karaoke), KSC, LRC
        </div>
      </Section>

      {/* Microphone */}
      <Section title="Microphone">
        <Row label="Input device">
          <select
            value={mic.inputDeviceId}
            onChange={e => mic.active ? onStartMic(e.target.value) : undefined}
            style={selectSt}
          >
            <option value="">Default</option>
            {inputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId.slice(0, 16)}</option>)}
          </select>
        </Row>
        <Row label="Mic gain">
          <input type="range" min={0} max={1} step={0.01} value={mic.micGain}
            onChange={e => onSetMicGain(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#e05' }} />
          <span style={valLabel}>{Math.round(mic.micGain * 100)}%</span>
        </Row>
        <Row label="Reverb">
          <input type="range" min={0} max={1} step={0.01} value={mic.reverbWet}
            onChange={() => {}} style={{ flex: 1, accentColor: '#e05', opacity: 0.4 }} disabled />
          <span style={valLabel}>{Math.round(mic.reverbWet * 100)}%</span>
        </Row>
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          {!mic.active ? (
            <button onClick={() => onStartMic()} style={{ ...btn, background: '#1a3a1a', color: '#4c8' }}>🎤 Enable Mic</button>
          ) : (
            <button onClick={onStopMic} style={{ ...btn, background: '#3a1a1a', color: '#c44' }}>■ Stop Mic</button>
          )}
          <div style={{ fontSize: 12, color: mic.active ? '#4c8' : '#555', alignSelf: 'center' }}>
            {mic.active ? 'Microphone active — audio passes through headphones/speakers' : 'Microphone off'}
          </div>
        </div>
      </Section>

      {/* Audio Output */}
      <Section title="Audio Output">
        <Row label="Output device">
          <select
            value={selectedOutput}
            onChange={e => {
              setSelectedOutput(e.target.value)
              // setSinkId on any audio elements is done by browser
              const audioEls = document.querySelectorAll('audio')
              audioEls.forEach(a => {
                if ('setSinkId' in a) (a as any).setSinkId(e.target.value).catch(() => {})
              })
            }}
            style={selectSt}
          >
            <option value="">System default</option>
            {outputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId.slice(0, 16)}</option>)}
          </select>
        </Row>
        <div style={{ fontSize: 11, color: '#555', marginTop: 6 }}>
          Select AirPlay or Bluetooth speakers from this list after pairing them at OS level.
        </div>
      </Section>

      {/* Casting */}
      <Section title="Casting">
        <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 8px' }}>
            <strong style={{ color: '#aaa' }}>AirPlay (macOS / iOS):</strong> Select your AirPlay device as the Audio Output above.
            The music will stream to the selected device automatically.
          </p>
          <p style={{ margin: '0 0 8px' }}>
            <strong style={{ color: '#aaa' }}>Chromecast:</strong> Open the browser menu → Cast… to mirror this tab to your TV.
            Or use a Cast-enabled browser which surfaces the cast button in the address bar.
          </p>
          <p style={{ margin: 0, fontSize: 11, color: '#444' }}>
            For best results on a TV: use an HDMI cable or set up screen mirroring at the OS level, then select Full Screen (F) in the player.
          </p>
        </div>
      </Section>

      {/* About */}
      <Section title="About">
        <div style={{ fontSize: 12, color: '#555', lineHeight: 1.8 }}>
          <div>Kara — Self-Hosted Karaoke</div>
          <div>Supports CDG, MKV, KSC, LRC formats</div>
          <div>Sources: Local files · YouTube · USDB (usdb.eu)</div>
          <div style={{ marginTop: 8, color: '#333' }}>Open source — contribute at github.com/9ninee/kara</div>
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 10, color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <div style={{ width: 90, fontSize: 12, color: '#666', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>{children}</div>
    </div>
  )
}

const inputSt: React.CSSProperties = { flex: 1, background: '#111', border: '1px solid #222', borderRadius: 6, color: '#ccc', padding: '6px 10px', fontSize: 12 }
const selectSt: React.CSSProperties = { flex: 1, background: '#111', border: '1px solid #222', borderRadius: 6, color: '#ccc', padding: '6px 8px', fontSize: 12 }
const btn: React.CSSProperties = { background: '#1a1a1a', border: '1px solid #333', color: '#ccc', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12, flexShrink: 0 }
const valLabel: React.CSSProperties = { fontSize: 11, color: '#555', width: 34, textAlign: 'right', flexShrink: 0 }
