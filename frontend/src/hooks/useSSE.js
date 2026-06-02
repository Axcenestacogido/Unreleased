import { useEffect, useRef, useState, createContext, useContext } from 'react'
import React from 'react'
import { useQueryClient } from '@tanstack/react-query'

export function useSSE() {
  const qc = useQueryClient()
  const abortRef = useRef(null)
  const [connected, setConnected] = useState(false)

  function handleEvent(event) {
    switch (event.type) {
      case 'connected':
        setConnected(true)
        break

      case 'listen': {
        // Update analytics cache immediately
        qc.setQueryData(['analytics'], (old) => {
          if (!old) return old
          return old.map((link) => {
            if (link.token !== event.token) return link
            const newEvent = event.listen_event
            return {
              ...link,
              play_count: event.play_count,
              events: newEvent
                ? [newEvent, ...link.events].slice(0, 20)
                : link.events,
            }
          })
        })

        // Update share-links cache (play count in ShareModal)
        qc.setQueryData(['share-links'], (old) => {
          if (!old) return old
          return old.map((link) =>
            link.token === event.token
              ? { ...link, play_count: event.play_count }
              : link
          )
        })
        break
      }

      case 'track_added':
      case 'track_version_added':
        // Invalidate tracks for this project so the list refreshes
        qc.invalidateQueries({ queryKey: ['tracks', String(event.project_id)] })
        break
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    let active = true
    let retryDelay = 1000

    async function connect() {
      setConnected(false)
      try {
        abortRef.current = new AbortController()

        const res = await fetch('/api/events', {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortRef.current.signal,
        })

        if (!res.ok) throw new Error(`SSE ${res.status}`)

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (active) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          // SSE frames are separated by double newline
          const frames = buffer.split('\n\n')
          buffer = frames.pop() ?? ''

          for (const frame of frames) {
            for (const line of frame.split('\n')) {
              if (line.startsWith('data: ')) {
                try { handleEvent(JSON.parse(line.slice(6))) } catch {}
              }
            }
          }
        }

        // Clean disconnect
        retryDelay = 1000
      } catch (err) {
        if (!active || err.name === 'AbortError') return
        setConnected(false)
        // Exponential backoff, cap at 30s
        await new Promise((r) => setTimeout(r, retryDelay))
        retryDelay = Math.min(retryDelay * 2, 30_000)
        if (active) connect()
      }
    }

    connect()

    return () => {
      active = false
      abortRef.current?.abort()
      setConnected(false)
    }
  }, [])

  return { connected }
}

export const SSEContext = createContext({ connected: false })

export function SSEProvider({ children }) {
  const { connected } = useSSE()
  return React.createElement(SSEContext.Provider, { value: { connected } }, children)
}

export function useSSEStatus() { return useContext(SSEContext) }
