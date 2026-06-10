import { Router, Request, Response, type IRouter } from 'express'
import { join } from 'path'
import { createReadStream, statSync, existsSync } from 'fs'
import { searchSongs, getArtists, getSongsByArtist, getSong, deleteSong, addSong, getHistory } from '../library/database.js'
import { scanFolder } from '../library/scanner.js'
import { searchYoutube, downloadYoutube } from '../sources/youtube.js'
import { searchUSDB } from '../sources/usdb.js'
import multer from 'multer'
import { randomUUID } from 'crypto'
import { parseKsc } from '../formats/mkv.js'
import { readFileSync } from 'fs'

const router: IRouter = Router()
const upload = multer({ dest: join(process.cwd(), '.kara-data', 'uploads') })

// ── Library ───────────────────────────────────────────────────────────────────

router.get('/library/songs', (req, res) => {
  res.json(searchSongs(req.query.q as string | undefined))
})

router.get('/library/artists', (_req, res) => {
  res.json(getArtists())
})

router.get('/library/artists/:id/songs', (req, res) => {
  res.json(getSongsByArtist(req.params.id))
})

router.delete('/library/songs/:id', (req, res) => {
  deleteSong(req.params.id)
  res.json({ ok: true })
})

router.get('/library/history', (_req, res) => {
  res.json(getHistory())
})

// Scan a folder path
router.post('/library/scan', async (req, res) => {
  const { folder } = req.body as { folder: string }
  if (!folder || !existsSync(folder)) return res.status(400).json({ error: 'folder not found' })
  const count = await scanFolder(folder)
  res.json({ indexed: count })
})

// Upload individual file(s)
router.post('/library/upload', upload.array('files'), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? []
  const added: string[] = []
  for (const f of files) {
    const parts = f.originalname.replace(/\.[^.]+$/, '').split(' - ')
    const artist = parts.length > 1 ? parts[0].trim() : 'Unknown'
    const title = parts.length > 1 ? parts.slice(1).join(' - ').trim() : f.originalname
    const song = addSong({ title, artist, duration: 0, source: 'upload', audio_path: f.path, video_path: null, cdg_path: null, lrc_path: null, subtitle_path: null, cover_url: null, format: 'lrc' })
    added.push(song.id)
  }
  res.json({ added })
})

// ── Media streaming ────────────────────────────────────────────────────────────

router.get('/media/:songId/:type', (req, res) => {
  const song = getSong(req.params.songId)
  if (!song) return res.status(404).end()

  const filePath = req.params.type === 'audio'   ? song.audio_path
                 : req.params.type === 'video'   ? song.video_path
                 : req.params.type === 'cdg'     ? song.cdg_path
                 : req.params.type === 'subtitle'? song.subtitle_path
                 : req.params.type === 'lrc'     ? song.lrc_path
                 : null

  if (!filePath || !existsSync(filePath)) return res.status(404).end()

  const stat = statSync(filePath)
  const range = req.headers.range

  if (range) {
    const [startStr, endStr] = range.replace('bytes=', '').split('-')
    const start = parseInt(startStr)
    const end = endStr ? parseInt(endStr) : stat.size - 1
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': mimeFor(filePath),
    })
    createReadStream(filePath, { start, end }).pipe(res)
  } else {
    res.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': mimeFor(filePath) })
    createReadStream(filePath).pipe(res)
  }
})

router.get('/media/:songId/lrc-data', (req, res) => {
  const song = getSong(req.params.songId)
  if (!song) return res.status(404).end()
  if (song.lrc_path && existsSync(song.lrc_path)) {
    return res.json({ type: 'lrc', content: readFileSync(song.lrc_path, 'utf8') })
  }
  if (song.subtitle_path && existsSync(song.subtitle_path)) {
    const raw = readFileSync(song.subtitle_path, 'utf8')
    if (song.subtitle_path.endsWith('.ksc')) {
      return res.json({ type: 'ksc', lines: parseKsc(raw) })
    }
    return res.json({ type: 'ass', content: raw })
  }
  res.status(404).json({ error: 'no lyrics' })
})

// ── Online search ──────────────────────────────────────────────────────────────

router.get('/sources/youtube', async (req, res) => {
  const q = req.query.q as string
  if (!q) return res.status(400).json({ error: 'q required' })
  try { res.json(await searchYoutube(q)) }
  catch (e) { res.status(500).json({ error: String(e) }) }
})

router.post('/sources/youtube/download', async (req, res) => {
  const { url, title } = req.body as { url: string; title: string }
  const dir = join(process.cwd(), '.kara-data', 'downloads')
  try {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    const path = await downloadYoutube(url, title, dir, pct => {
      res.write(`data: ${JSON.stringify({ percent: pct })}\n\n`)
    })
    res.write(`data: ${JSON.stringify({ done: true, path })}\n\n`)
    res.end()
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: String(e) })}\n\n`)
    res.end()
  }
})

router.get('/sources/usdb', async (req, res) => {
  const q = req.query.q as string
  if (!q) return res.status(400).json({ error: 'q required' })
  try { res.json(await searchUSDB(q)) }
  catch (e) { res.status(500).json({ error: String(e) }) }
})

// ── QR / info ──────────────────────────────────────────────────────────────────

router.get('/info', (req, res) => {
  const host = req.hostname
  res.json({ host, port: req.socket.localPort, version: '2.0.0' })
})

function mimeFor(p: string): string {
  if (p.endsWith('.mp3')) return 'audio/mpeg'
  if (p.endsWith('.m4a')) return 'audio/mp4'
  if (p.endsWith('.ogg')) return 'audio/ogg'
  if (p.endsWith('.mkv')) return 'video/x-matroska'
  if (p.endsWith('.mp4')) return 'video/mp4'
  if (p.endsWith('.cdg')) return 'application/octet-stream'
  return 'application/octet-stream'
}

export default router
