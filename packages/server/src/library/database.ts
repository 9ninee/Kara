import { DatabaseSync } from 'node:sqlite'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { randomUUID } from 'crypto'

const DATA_DIR = process.env.KARA_DATA ?? join(process.cwd(), '.kara-data')
mkdirSync(DATA_DIR, { recursive: true })

const db = new DatabaseSync(join(DATA_DIR, 'library.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS artists (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    play_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS songs (
    id            TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    artist_id     TEXT REFERENCES artists(id),
    duration      INTEGER DEFAULT 0,
    source        TEXT DEFAULT 'local',
    audio_path    TEXT,
    video_path    TEXT,
    cdg_path      TEXT,
    lrc_path      TEXT,
    subtitle_path TEXT,
    cover_url     TEXT,
    format        TEXT DEFAULT 'cdg',
    added_at      INTEGER DEFAULT (strftime('%s','now')),
    play_count    INTEGER DEFAULT 0,
    last_played   INTEGER
  );

  CREATE TABLE IF NOT EXISTS play_history (
    id          TEXT PRIMARY KEY,
    song_id     TEXT REFERENCES songs(id),
    singer_name TEXT,
    played_at   INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist_id);
  CREATE INDEX IF NOT EXISTS idx_songs_title  ON songs(title);
`)

export interface Artist {
  id: string
  name: string
  play_count: number
}

export interface Song {
  id: string
  title: string
  artist_id: string | null
  artist?: string
  duration: number
  source: string
  audio_path: string | null
  video_path: string | null
  cdg_path: string | null
  lrc_path: string | null
  subtitle_path: string | null
  cover_url: string | null
  format: string
  play_count: number
  last_played: number | null
}

function upsertArtist(name: string): string {
  const existing = db.prepare('SELECT id FROM artists WHERE name = ?').get(name) as { id: string } | undefined
  if (existing) return existing.id
  const id = randomUUID()
  db.prepare('INSERT INTO artists (id, name) VALUES (?, ?)').run(id, name)
  return id
}

export function addSong(song: Omit<Song, 'id' | 'artist_id' | 'play_count' | 'last_played'> & { artist: string }): Song {
  const artist_id = upsertArtist(song.artist)
  const id = randomUUID()
  db.prepare(`
    INSERT OR REPLACE INTO songs
      (id, title, artist_id, duration, source, audio_path, video_path, cdg_path, lrc_path, subtitle_path, cover_url, format)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, song.title, artist_id, song.duration, song.source,
    song.audio_path, song.video_path, song.cdg_path, song.lrc_path,
    song.subtitle_path, song.cover_url, song.format)
  return getSong(id)!
}

export function getSong(id: string): Song | null {
  return db.prepare(`
    SELECT s.*, a.name AS artist FROM songs s
    LEFT JOIN artists a ON s.artist_id = a.id
    WHERE s.id = ?
  `).get(id) as unknown as Song | null
}

export function searchSongs(query?: string): Song[] {
  if (!query?.trim()) {
    return db.prepare(`
      SELECT s.*, a.name AS artist FROM songs s
      LEFT JOIN artists a ON s.artist_id = a.id
      ORDER BY a.name ASC, s.title ASC
    `).all() as unknown as Song[]
  }
  const q = `%${query}%`
  return db.prepare(`
    SELECT s.*, a.name AS artist FROM songs s
    LEFT JOIN artists a ON s.artist_id = a.id
    WHERE s.title LIKE ? OR a.name LIKE ?
    ORDER BY a.name ASC, s.title ASC
  `).all(q, q) as unknown as Song[]
}

export function getArtists(): Artist[] {
  return db.prepare('SELECT * FROM artists ORDER BY name ASC').all() as unknown as Artist[]
}

export function getSongsByArtist(artistId: string): Song[] {
  return db.prepare(`
    SELECT s.*, a.name AS artist FROM songs s
    LEFT JOIN artists a ON s.artist_id = a.id
    WHERE s.artist_id = ? ORDER BY s.title ASC
  `).all(artistId) as unknown as Song[]
}

export function deleteSong(id: string): void {
  db.prepare('DELETE FROM songs WHERE id = ?').run(id)
}

export function recordPlay(songId: string, singerName: string): void {
  db.prepare('INSERT INTO play_history (id, song_id, singer_name) VALUES (?, ?, ?)').run(randomUUID(), songId, singerName)
  db.prepare('UPDATE songs SET play_count = play_count + 1, last_played = strftime(\'%s\',\'now\') WHERE id = ?').run(songId)
  db.prepare('UPDATE artists SET play_count = play_count + 1 WHERE id = (SELECT artist_id FROM songs WHERE id = ?)').run(songId)
}

export function getHistory(limit = 50) {
  return db.prepare(`
    SELECT h.*, s.title, a.name AS artist FROM play_history h
    JOIN songs s ON h.song_id = s.id
    LEFT JOIN artists a ON s.artist_id = a.id
    ORDER BY h.played_at DESC LIMIT ?
  `).all(limit)
}
