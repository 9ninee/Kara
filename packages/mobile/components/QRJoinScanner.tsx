import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

interface QRJoinScannerProps {
  /** Called with (host, port) parsed from a kara://join QR code */
  onJoin: (host: string, port: string) => void
  onCancel: () => void
}

// expo-barcode-scanner needs a native module — absent in some environments
// (web, bare simulators). Load lazily so the bundle never hard-crashes.
let BarCodeScanner: React.ComponentType<{
  onBarCodeScanned: (event: { data: string }) => void
  style?: object
}> | null = null
let requestPermissions: (() => Promise<{ status: string }>) | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('expo-barcode-scanner')
  BarCodeScanner = mod.BarCodeScanner
  requestPermissions = mod.BarCodeScanner.requestPermissionsAsync
} catch {
  // scanner unavailable — component renders a hint instead
}

function parseJoinUrl(data: string): { host: string; port: string } | null {
  // kara://join?host=192.168.1.10&port=3000&session=<uuid>
  const host = data.match(/[?&]host=([^&]+)/)?.[1]
  const port = data.match(/[?&]port=([^&]+)/)?.[1]
  if (data.startsWith('kara://join') && host && port) return { host, port }
  return null
}

export function QRJoinScanner({ onJoin, onCancel }: QRJoinScannerProps): React.ReactElement {
  const [permission, setPermission] = useState<'pending' | 'granted' | 'denied'>('pending')
  const [scanned, setScanned] = useState(false)

  useEffect(() => {
    if (!requestPermissions) {
      setPermission('denied')
      return
    }
    requestPermissions()
      .then(({ status }) => setPermission(status === 'granted' ? 'granted' : 'denied'))
      .catch(() => setPermission('denied'))
  }, [])

  const handleScan = ({ data }: { data: string }) => {
    if (scanned) return
    const parsed = parseJoinUrl(data)
    if (parsed) {
      setScanned(true)
      onJoin(parsed.host, parsed.port)
    }
  }

  return (
    <View style={styles.wrap}>
      {BarCodeScanner && permission === 'granted' ? (
        <BarCodeScanner onBarCodeScanned={handleScan} style={styles.scanner} />
      ) : (
        <Text style={styles.hint}>
          {permission === 'pending'
            ? 'Requesting camera permission…'
            : 'Camera unavailable. Enter the host IP manually instead.'}
        </Text>
      )}
      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12, borderRadius: 10, overflow: 'hidden', backgroundColor: '#000' },
  scanner: { height: 240, width: '100%' },
  hint: { color: '#888', padding: 20, textAlign: 'center', fontSize: 13 },
  cancelBtn: { padding: 12, alignItems: 'center', backgroundColor: '#1a1a1a' },
  cancelText: { color: '#f66', fontWeight: '600', fontSize: 14 },
})
