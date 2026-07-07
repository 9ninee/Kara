import React from 'react'
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native'
import { setAudioModeAsync } from 'expo-audio'
import Constants, { ExecutionEnvironment } from 'expo-constants'

// react-native-google-cast needs a custom native build. In Expo Go the JS
// module loads (so require() alone doesn't fail) but the native view is
// missing and rendering it crashes with "View config not found for
// RNGoogleCastButton" — detect Expo Go explicitly and skip it there.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient
let CastButton: React.ComponentType<{ style?: object; tintColor?: string }> | null = null
if (!isExpoGo && Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    CastButton = require('react-native-google-cast').CastButton
  } catch {
    // Chromecast SDK not linked (simulator / bare build without the pod)
  }
}

interface CastingButtonProps {
  style?: object
}

export function CastingButton({ style }: CastingButtonProps): React.ReactElement {
  const showAirPlayPicker = async () => {
    if (Platform.OS !== 'ios') return
    try {
      // Set audio mode so AirPlay routes are available
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
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
