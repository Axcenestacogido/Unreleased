import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const PlayerContext = createContext(null)

export function PlayerProvider({ children }) {
  const [currentTrack, setCurrentTrack] = useState(null)
  const [queue, setQueue] = useState([])

  // Update mediaSession metadata for iOS lock screen controls
  useEffect(() => {
    if (!currentTrack || !('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.name,
      artist: currentTrack.project_name || 'MusicVault',
    })
  }, [currentTrack])

  const play = useCallback((track, trackList = []) => {
    setCurrentTrack(track)
    setQueue(trackList)
  }, [])

  const playNext = useCallback(() => {
    if (!currentTrack || !queue.length) return
    const idx = queue.findIndex((t) => t.id === currentTrack.id)
    if (idx < queue.length - 1) setCurrentTrack(queue[idx + 1])
  }, [currentTrack, queue])

  const playPrev = useCallback(() => {
    if (!currentTrack || !queue.length) return
    const idx = queue.findIndex((t) => t.id === currentTrack.id)
    if (idx > 0) setCurrentTrack(queue[idx - 1])
  }, [currentTrack, queue])

  return (
    <PlayerContext.Provider value={{ currentTrack, play, playNext, playPrev }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  return useContext(PlayerContext)
}
