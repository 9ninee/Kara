import React, { useEffect, useState } from 'react'

interface DevicePickerProps {
  type: 'audioinput' | 'audiooutput'
  label: string
  selected: string
  onChange: (deviceId: string) => void
}

export default function DevicePicker({
  type,
  label,
  selected,
  onChange,
}: DevicePickerProps): React.ReactElement {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])

  useEffect(() => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((all) => setDevices(all.filter((d) => d.kind === type)))
      .catch((err: unknown) => console.warn('[DevicePicker] enumerateDevices failed', err))
  }, [type])

  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, color: '#aaa' }}>{label}</span>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: '#1a1a1a',
          color: '#fff',
          border: '1px solid #333',
          borderRadius: 6,
          padding: '6px 8px',
          fontSize: 14,
        }}
      >
        <option value="">System default</option>
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || d.deviceId}
          </option>
        ))}
      </select>
    </label>
  )
}
