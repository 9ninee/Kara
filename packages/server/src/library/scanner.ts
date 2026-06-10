import { watch } from 'chokidar'
import { readdirSync, statSync, existsSync } from 'fs'
import { basename, extname, join, dirname } from 'path'
import { addSong, getSongByPath } from './database.js'
import { extractMkv, probeMediaDuration } from '../formats/mkv.js'

const AUDIO_EXT = new Set(['.mp3', '.m4a', '.ogg', '.flac', '.wav'])
const VIDEO_EXT = new Set(['.mkv', '.mp4', '.webm'])
const CDG_EXT = '.cdg'

function parseName(filename: string): { title: string; artist: string } {
  const base = basename(filename, extname(filename))
  const dash = base.indexOf(' - ')
  if (dash !== -1) return { artist: base.slice(0, dash).trim(), title: base.slice(dash + 3).trim() }
  return { artist: 'Unknown', title: base.trim() }
}

// Returns true if a new song was indexed
async function indexFile(filePath: string): Promise<boolean> {
  const ext = extname(filePath).toLowerCase()
  const dir = dirname(filePath)
  const base = basename(filePath, ext)

  if (AUDIO_EXT.has(ext)) {
    if (getSongByPath(filePath)) return false
    // Audio extracted from a sibling MKV is owned by the MKV entry
    if (existsSync(join(dir, base + '.mkv'))) return false
    const cdgPath = join(dir, base + CDG_EXT)
    const lrcPath = join(dir, base + '.lrc')
    const kscPath = join(dir, base + '.ksc')
    const { title, artist } = parseName(filePath)
    const duration = await probeMediaDuration(filePath)
    try {
      addSong({
        title,
        artist,
        duration,
        source: 'local',
        audio_path: filePath,
        video_path: null,
        cdg_path: existsSync(cdgPath) ? cdgPath : null,
        lrc_path: existsSync(lrcPath) ? lrcPath : null,
        subtitle_path: existsSync(kscPath) ? kscPath : null,
        cover_url: null,
        format: existsSync(cdgPath) ? 'cdg' : 'lrc',
      })
      return true
    } catch { return false }
  }

  if (ext === '.mkv') {
    if (getSongByPath(filePath)) return false
    const { title, artist } = parseName(filePath)
    try {
      const { audioPath, subtitlePath } = await extractMkv(filePath)
      const duration = await probeMediaDuration(audioPath)
      addSong({
        title,
        artist,
        duration,
        source: 'local',
        audio_path: audioPath,
        video_path: filePath,
        cdg_path: null,
        lrc_path: null,
        subtitle_path: subtitlePath,
        cover_url: null,
        format: 'mkv',
      })
      return true
    } catch { return false } // ffmpeg not available or already indexed
  }

  return false
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
        if (await indexFile(full)) count++
      }
    }
  }
  await recurse(folderPath)
  return count
}

export function watchFolder(folderPath: string): void {
  watch(folderPath, { ignoreInitial: true, depth: 10 }).on('add', (p) => { void indexFile(p) })
}
