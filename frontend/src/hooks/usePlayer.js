import React, { createContext, useContext, useState, useCallback } from 'react'

const PlayerContext = createContext(null)

export function PlayerProvider({ children }) {
  const [currentTrack, setCurrentTrack] = useState(null)
  const [queue, setQueue] = useState([])

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

  const playRandom = useCallback(() => {
    if (!queue.length) return
    const others = queue.filter(t => t.id !== currentTrack?.id)
    if (!others.length) return
    setCurrentTrack(others[Math.floor(Math.random() * others.length)])
  }, [currentTrack, queue])

  return React.createElement(
    PlayerContext.Provider,
    { value: { currentTrack, play, playNext, playPrev, playRandom } },
    children
  )
}

export function usePlayer() {
  return useContext(PlayerContext)
}
