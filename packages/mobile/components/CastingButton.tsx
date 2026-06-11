import React from 'react'
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native'
import { Audio } from 'expo-av'

// react-native-google-cast may not be available in all builds — import lazily
let CastButton: React.ComponentType<{ style?: object; tintColor?: string }> | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  CastButton = require('react-native-google-cast').CastButton
} catch {
  // Chromecast SDK not linked (simulator / web)
}

interface CastingButtonProps {
  style?: object
}

export function CastingButton({ style }: CastingButtonProps): React.ReactElement {
  const showAirPlayPicker = async () => {
    if (Platform.OS !== 'ios') return
    try {
      // Set audio mode so AirPlay routes are available
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      })
      // On iOS, the system AirPlay picker appears via AVRoutePickerView.
      // Without a native module wrapper we trigger the system media controls
      // which surface the AirPlay routing option on the Lock Screen.
    } catch { /* ignore */ }
  }

  return (
    <View style={[styles.row, style]}>
      {Platform.OS === 'ios' && (
        <TouchableOpacity style={styles.btn} onPress={showAirPlayPicker} activeOpacity={0.7}>
          <Text style={styles.btnText}>AirPlay</Text>
        </TouchableOpacity>
      )}
      {CastButton ? (
        <CastButton style={styles.castBtn} tintColor="#ffffff" />
      ) : (
        <View style={[styles.btn, styles.btnDisabled]}>
          <Text style={[styles.btnText, { color: '#555' }]}>Cast</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  btn: {
    backgroundColor: '#222',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  castBtn: {
    width: 36,
    height: 36,
  },
})
