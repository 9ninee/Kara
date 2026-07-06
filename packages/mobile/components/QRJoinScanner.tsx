import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'

interface QRJoinScannerProps {
  /** Called with (host, port) parsed from a kara://join QR code */
  onJoin: (host: string, port: string) => void
  onCancel: () => void
}

function parseJoinUrl(data: string): { host: string; port: string } | null {
  // kara://join?host=192.168.1.10&port=3000&session=<uuid>
  const host = data.match(/[?&]host=([^&]+)/)?.[1]
  const port = data.match(/[?&]port=([^&]+)/)?.[1]
  if (data.startsWith('kara://join') && host && port) return { host, port }
  return null
}

export function QRJoinScanner({ onJoin, onCancel }: QRJoinScannerProps): React.ReactElement {
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission().catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission?.granted])

  const handleScan = ({ data }: { data: string }) => {
    const parsed = parseJoinUrl(data)
    if (parsed) {
      setScanned(true)
      onJoin(parsed.host, parsed.port)
    }
  }

  return (
    <View style={styles.wrap}>
      {permission?.granted ? (
        <CameraView
          // pause scanning after the first successful parse
          onBarcodeScanned={scanned ? undefined : handleScan}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          style={styles.scanner}
        />
      ) : (
        <Text style={styles.hint}>
          {!permission
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
