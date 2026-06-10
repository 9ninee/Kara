import { useRef, useState, useEffect, useCallback } from 'react'
import { CDGPlayer, parseLRC } from '@kara/shared'
import type { LyricsLine } from '@kara/shared'

export interface PlayerControls {
  audioRef: React.RefObject<HTMLAudioElement | null>
  cdgPlayer: CDGPlayer | null
  lrcLines: LyricsLine[]
  assContent: string | null
  loading: boolean
  loadSong: (songId: string, format: string) => Promise<void>
}

export function usePlayer(): PlayerControls {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [cdgPlayer, setCdgPlayer] = useState<CDGPlayer | null>(null)
  const [lrcLines, setLrcLines] = useState<LyricsLine[]>([])
  const [assContent, setAssContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadSong = useCallback(async (songId: string, format: string) => {
    setLoading(true)
    setCdgPlayer(null)
    setLrcLines([])
    setAssContent(null)
    try {
      if (!audioRef.current) audioRef.current = new Audio()
      audioRef.current.src = `/media/${songId}/audio`
      audioRef.current.load()

      if (format === 'cdg') {
        const resp = await fetch(`/media/${songId}/cdg`)
        const buf = await resp.arrayBuffer()
        setCdgPlayer(new CDGPlayer(buf))
      }

      const lyricsResp = await fetch(`/media/${songId}/lrc-data`).catch(() => null)
      if (lyricsResp?.ok) {
        const data = await lyricsResp.json()
        if (data.type === 'lrc') setLrcLines(parseLRC(data.content))
        else if (data.type === 'ksc') setLrcLines(data.lines)
        else if (data.type === 'ass') setAssContent(data.content)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  return { audioRef, cdgPlayer, lrcLines, assContent, loading, loadSong }
}
