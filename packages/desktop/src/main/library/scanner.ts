import { readdirSync, statSync } from 'fs'
import { extname, basename, join, dirname } from 'path'
import { insertSong } from './database'
import type { Song } from '@kara/shared'

function titleFromFilename(filename: string): { title: string; artist: string } {
  const name = basename(filename, extname(filename))
  const match = name.match(/^(.+?)\s*[-–]\s*(.+)$/)
  if (match) return { artist: match[1].trim(), title: match[2].trim() }
  return { artist: 'Unknown', title: name }
}

export function scanFiles(filePaths: string[]): Song[] {
  const added: Song[] = []
  const mp3s = filePaths.filter((f) => extname(f).toLowerCase() === '.mp3')
  const cdgs = filePaths.filter((f) => extname(f).toLowerCase() === '.cdg')
  const lrcs = filePaths.filter((f) => extname(f).toLowerCase() === '.lrc')

  for (const mp3 of mp3s) {
    const base = mp3.slice(0, -4)
    const cdg = cdgs.find((c) => c.slice(0, -4).toLowerCase() === base.toLowerCase())
    const lrc = lrcs.find((l) => l.slice(0, -4).toLowerCase() === base.toLowerCase())
    const { title, artist } = titleFromFilename(mp3)
    const song = insertSong({
      title,
      artist,
      duration: 0,
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
