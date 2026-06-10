import { watch } from 'chokidar'
import { readdirSync, statSync } from 'fs'
import { basename, extname, join, dirname } from 'path'
import { addSong } from './database.js'
import { extractMkv } from '../formats/mkv.js'

const AUDIO_EXT = new Set(['.mp3', '.m4a', '.ogg', '.flac', '.wav'])
const VIDEO_EXT = new Set(['.mkv', '.mp4', '.webm'])
const CDG_EXT = '.cdg'

function parseName(filename: string): { title: string; artist: string } {
  const base = basename(filename, extname(filename))
  const dash = base.indexOf(' - ')
  if (dash !== -1) return { artist: base.slice(0, dash).trim(), title: base.slice(dash + 3).trim() }
  return { artist: 'Unknown', title: base.trim() }
}

async function indexFile(filePath: string): Promise<void> {
  const ext = extname(filePath).toLowerCase()
  const dir = dirname(filePath)
  const base = basename(filePath, ext)

  if (AUDIO_EXT.has(ext)) {
    const cdgPath = join(dir, base + CDG_EXT)
    const lrcPath = join(dir, base + '.lrc')
    const { title, artist } = parseName(filePath)
    try {
      addSong({
        title,
        artist,
        duration: 0,
        source: 'local',
        audio_path: filePath,
        video_path: null,
        cdg_path: cdgPath && require('fs').existsSync(cdgPath) ? cdgPath : null,
        lrc_path: lrcPath && require('fs').existsSync(lrcPath) ? lrcPath : null,
        subtitle_path: null,
        cover_url: null,
        format: require('fs').existsSync(cdgPath) ? 'cdg' : 'lrc',
      })
    } catch { /* already indexed */ }
  }

  if (ext === '.mkv') {
    const { title, artist } = parseName(filePath)
    try {
      const { audioPath, subtitlePath } = await extractMkv(filePath)
      addSong({
        title,
        artist,
        duration: 0,
        source: 'local',
        audio_path: audioPath,
        video_path: filePath,
        cdg_path: null,
        lrc_path: null,
        subtitle_path: subtitlePath,
        cover_url: null,
        format: 'mkv',
      })
    } catch { /* ffmpeg not available or already indexed */ }
  }
}

export async function scanFolder(folderPath: string): Promise<number> {
  let count = 0
  const recurse = async (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) { await recurse(full); continue }
      const ext = extname(entry).toLowerCase()
      if (AUDIO_EXT.has(ext) || VIDEO_EXT.has(ext)) {
        await indexFile(full)
        count++
      }
    }
  }
  await recurse(folderPath)
  return count
}

export function watchFolder(folderPath: string): void {
  watch(folderPath, { ignoreInitial: false, depth: 10 }).on('add', (p) => indexFile(p))
}
