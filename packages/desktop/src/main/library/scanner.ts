import { readdirSync, statSync, existsSync } from 'fs'
import { extname, basename, join } from 'path'
import { insertSong, findSongByAudioPath } from './database'
import type { Song } from '@kara/shared'

// CDG data plays at 300 24-byte sectors per second
const CDG_BYTES_PER_SECOND = 300 * 24

function titleFromFilename(filename: string): { title: string; artist: string } {
  const name = basename(filename, extname(filename))
  const match = name.match(/^(.+?)\s*[-–]\s*(.+)$/)
  if (match) return { artist: match[1].trim(), title: match[2].trim() }
  return { artist: 'Unknown', title: name }
}

/** Find a sidecar file (.cdg/.lrc) either in the selected list or on disk next to the MP3 */
function findSidecar(mp3Path: string, ext: string, candidates: string[]): string | undefined {
  const base = mp3Path.slice(0, -4)
  const fromList = candidates.find((c) => c.slice(0, -4).toLowerCase() === base.toLowerCase())
  if (fromList) return fromList
  for (const probe of [base + ext, base + ext.toUpperCase()]) {
    if (existsSync(probe)) return probe
  }
  return undefined
}

function durationFromCdg(cdgPath: string): number {
  try {
    return Math.round(statSync(cdgPath).size / CDG_BYTES_PER_SECOND)
  } catch {
    return 0
  }
}

export function scanFiles(filePaths: string[]): Song[] {
  const added: Song[] = []
  const mp3s = filePaths.filter((f) => extname(f).toLowerCase() === '.mp3')
  const cdgs = filePaths.filter((f) => extname(f).toLowerCase() === '.cdg')
  const lrcs = filePaths.filter((f) => extname(f).toLowerCase() === '.lrc')

  for (const mp3 of mp3s) {
    if (findSongByAudioPath(mp3)) continue // already imported
    const cdg = findSidecar(mp3, '.cdg', cdgs)
    const lrc = findSidecar(mp3, '.lrc', lrcs)
    const { title, artist } = titleFromFilename(mp3)
    const song = insertSong({
      title,
      artist,
      duration: cdg ? durationFromCdg(cdg) : 0,
      source: 'local',
      audioPath: mp3,
      cdgPath: cdg,
      lrcPath: lrc,
    })
    added.push(song)
  }
  return added
}

export function scanFolder(folderPath: string): Song[] {
  const allFiles: string[] = []
  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        walk(full)
      } else {
        allFiles.push(full)
      }
    }
  }
  walk(folderPath)
  return scanFiles(allFiles)
}
