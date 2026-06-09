import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { getCurrentLineIndex, getLineProgress } from '@kara/shared'
import type { LyricsLine } from '@kara/shared'

interface Props {
  lines: LyricsLine[]
  currentTimeMs: number
}

export default function LyricsDisplay({ lines, currentTimeMs }: Props) {
  const activeIdx = getCurrentLineIndex(lines, currentTimeMs)
  const windowStart = Math.max(0, activeIdx - 1)
  const windowLines = lines.slice(windowStart, windowStart + 4)

  return (
    <View style={styles.container}>
      {windowLines.map((line, i) => {
        const idx = windowStart + i
        const isActive = idx === activeIdx
        const progress = isActive ? getLineProgress(line, currentTimeMs) : 0

        return (
          <View key={idx} style={styles.lineWrapper}>
            <Text
              style={[
                styles.lineText,
                isActive ? styles.activeLine : styles.inactiveLine,
              ]}
            >
              {line.text}
            </Text>
            {isActive && (
              <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
            )}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  lineWrapper: {
    alignItems: 'center',
    position: 'relative',
  },
  lineText: {
    textAlign: 'center',
    fontWeight: '600',
  },
  activeLine: {
    fontSize: 28,
    color: '#fff',
  },
  inactiveLine: {
    fontSize: 20,
    color: '#555',
  },
  progressBar: {
    position: 'absolute',
    bottom: -2,
    left: 0,
    height: 3,
    backgroundColor: '#ee0055',
    borderRadius: 2,
  },
})
