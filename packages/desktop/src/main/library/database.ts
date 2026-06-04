import { DatabaseSync, StatementSync } from 'node:sqlite'
import { app, IpcMain } from 'electron'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { Song } from '@kara/shared'

let db: DatabaseSync

export async function initDatabase(): Promise<void> {
  const dbPath = join(app.getPath('userData'), 'library.db')
  db = new DatabaseSync(dbPath)
  db.exec(`
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      duration INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'local',
      audio_path TEXT NOT NULL,
      cdg_path TEXT,
      lrc_path TEXT,
      added_at INTEGER NOT NULL,
      last_played_at INTEGER,
      play_count INTEGER NOT NULL DEFAULT 0,
      cover_url TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs (artist);
    CREATE INDEX IF NOT EXISTS idx_songs_title ON songs (title);
  `)
}

function rowToSong(row: Record<string, unknown>): Song {
  return {
    id: row.id as string,
    title: row.title as string,
    artist: row.artist as string,
    duration: row.duration as number,
    source: (row.source as Song['source']) ?? 'local',
    audioPath: row.audio_path as string,
    cdgPath: (row.cdg_path as string) ?? undefined,
    lrcPath: (row.lrc_path as string) ?? undefined,
    addedAt: row.added_at as number,
    lastPlayedAt: (row.last_played_at as number) ?? undefined,
    playCount: row.play_count as number,
    coverUrl: (row.cover_url as string) ?? undefined,
  }
}

export function getSongs(query?: string): Song[] {
  if (!query) {
    return (db.prepare('SELECT * FROM songs ORDER BY artist, title').all() as Record<string, unknown>[]).map(rowToSong)
  }
  const like = `%${query}%`
  return (db
    .prepare('SELECT * FROM songs WHERE title LIKE ? OR artist LIKE ? ORDER BY artist, title')
    .all(like, like) as Record<string, unknown>[]).map(rowToSong)
}

export function insertSong(song: Omit<Song, 'id' | 'addedAt' | 'playCount'>): Song {
  const id = randomUUID()
  const addedAt = Date.now()
  db.prepare(`
    INSERT INTO songs (id, title, artist, duration, source, audio_path, cdg_path, lrc_path, added_at, play_count, cover_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    id,
    song.title,
    song.artist,
    song.duration,
    song.source,
    song.audioPath,
    song.cdgPath ?? null,
    song.lrcPath ?? null,
    addedAt,
    song.coverUrl ?? null,
  )
  return { ...song, id, addedAt, playCount: 0 }
}

export function deleteSong(songId: string): void {
  db.prepare('DELETE FROM songs WHERE id = ?').run(songId)
}

export function incrementPlayCount(songId: string): void {
  db.prepare('UPDATE songs SET play_count = play_count + 1, last_played_at = ? WHERE id = ?').run(
    Date.now(),
    songId,
  )
}

export function registerLibraryHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('library:get-songs', (_e, query?: string) => getSongs(query))
  ipcMain.handle('library:delete-song', (_e, songId: string) => deleteSong(songId))
  ipcMain.handle('library:add-songs', async (_e, filePaths: string[]) => {
    const { scanFiles } = await import('./scanner')
    return scanFiles(filePaths)
  })
  ipcMain.handle('library:import-folder', async (_e, folderPath: string) => {
    const { scanFolder } = await import('./scanner')
    return scanFolder(folderPath)
  })
}
