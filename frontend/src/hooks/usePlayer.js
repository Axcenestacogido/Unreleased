import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

const PlayerContext = createContext(null)

export function PlayerProvider({ children }) {
  const [currentTrack, setCurrentTrack] = useState(null)
  const [queue, setQueue] = useState([])
  const [playing, setPlaying] = useState(false)

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

  return React.createElement(
    PlayerContext.Provider,
    { value: { currentTrack, queue, play, playNext, playPrev, playing, setPlaying } },
    children
  )
}

export function usePlayer() {
  return useContext(PlayerContext)
}
