import { useRef, useState, useCallback, useEffect } from 'react'
import * as Tone from 'tone'
import { getCachedAudio, cacheAudio, isAudioCached } from '../utils/audioCache'

function extractPeaks(audioBuffer, numBars = 300) {
  const data = audioBuffer.getChannelData(0)
  const step = Math.floor(data.length / numBars)
  const peaks = []
  for (let i = 0; i < numBars; i++) {
    let max = 0
    const end = Math.min((i + 1) * step, data.length)
    for (let j = i * step; j < end; j++) {
      const v = Math.abs(data[j])
      if (v > max) max = v
    }
    peaks.push(max)
  }
  const maxPeak = Math.max(...peaks, 0.001)
  return peaks.map((p) => p / maxPeak)
}

export function useAudioEngine() {
  const [isLoading, setIsLoading] = useState(false)
  const [peaks, setPeaks] = useState([])
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [speed, setSpeedState] = useState(1)
  const [pitch, setPitchState] = useState(0)
  const [loopEnabled, setLoopEnabledState] = useState(false)
  const [loopA, setLoopA] = useState(0)
  const [loopB, setLoopB] = useState(0)
  const [volume, setVolumeState] = useState(0.8)
  const [isCached, setIsCached] = useState(false)

  const playerRef = useRef(null)
  const pitchShiftRef = useRef(null)
  const rafRef = useRef(null)

  const startContextTimeRef = useRef(0)
  const startOffsetRef = useRef(0)
  const speedRef = useRef(1)
  const pitchRef = useRef(0)   // user-desired pitch, separate from compensated value
  const playingRef = useRef(false)
  const durationRef = useRef(0)
  const loadGenRef = useRef(0) // increments on every loadTrack call; stale loads bail early

  function _dispose() {
    cancelAnimationFrame(rafRef.current)
    try { playerRef.current?.stop() } catch {}
    playerRef.current?.dispose()
    pitchShiftRef.current?.dispose()
    playerRef.current = null
    pitchShiftRef.current = null
    setPlaying(false)
    playingRef.current = false
    setCurrentTime(0)
    startOffsetRef.current = 0
  }

  function _startRaf() {
    cancelAnimationFrame(rafRef.current)
    const tick = () => {
      if (!playingRef.current) return
      const t = startOffsetRef.current + (Tone.now() - startContextTimeRef.current) * speedRef.current
      if (t >= durationRef.current) {
        // Natural end — stop cleanly
        cancelAnimationFrame(rafRef.current)
        setCurrentTime(durationRef.current)
        setPlaying(false)
        playingRef.current = false
        return
      }
      setCurrentTime(Math.max(0, t))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const loadTrack = useCallback(async (trackId) => {
    const gen = ++loadGenRef.current // capture this load's generation
    _dispose()
    setIsLoading(true)
    setPeaks([])
    setDuration(0)
    setCurrentTime(0)
    setPitchState(0)
    pitchRef.current = 0
    setSpeedState(1)
    speedRef.current = 1
    setLoopEnabledState(false)
    setLoopA(0)
    setLoopB(0)
    setIsCached(false)

    try {
      await Tone.start()

      // Check local cache first — instant load on repeat plays
      let arrayBuffer = await getCachedAudio(trackId)
      if (gen !== loadGenRef.current) return

      if (arrayBuffer) {
        setIsCached(true)
      } else {
        const token = localStorage.getItem('token')
        const res = await fetch(`/api/tracks/${trackId}/stream`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('Stream failed')
        if (gen !== loadGenRef.current) return
        arrayBuffer = await res.arrayBuffer()
        if (gen !== loadGenRef.current) return
        // Cache a copy in the background (decodeAudioData may detach the original)
        cacheAudio(trackId, arrayBuffer.slice(0)).then(() => {
          if (gen === loadGenRef.current) setIsCached(true)
        })
      }

      if (gen !== loadGenRef.current) return

      const webAudioBuffer = await Tone.context.rawContext.decodeAudioData(arrayBuffer)

      if (gen !== loadGenRef.current) return

      const dur = webAudioBuffer.duration
      setDuration(dur)
      durationRef.current = dur
      setLoopB(dur)
      setPeaks(extractPeaks(webAudioBuffer))

      const toneBuffer = new Tone.ToneAudioBuffer(webAudioBuffer)
      const pitchShift = new Tone.PitchShift(0).toDestination()
      const player = new Tone.Player(toneBuffer).connect(pitchShift)
      player.playbackRate = 1

      // onstop fires on seek-stops too; rAF handles natural end, so just clean up here
      player.onstop = () => {
        if (playingRef.current && playerRef.current === player) {
          const pos = startOffsetRef.current + (Tone.now() - startContextTimeRef.current) * speedRef.current
          if (pos >= durationRef.current - 0.15) {
            cancelAnimationFrame(rafRef.current)
            setCurrentTime(durationRef.current)
            setPlaying(false)
            playingRef.current = false
          }
        }
      }

      pitchShiftRef.current = pitchShift
      playerRef.current = player
    } catch (err) {
      if (gen === loadGenRef.current) console.error('Audio load error:', err)
    } finally {
      if (gen === loadGenRef.current) setIsLoading(false)
    }
  }, [])

  const play = useCallback(async (offset) => {
    if (!playerRef.current) return
    await Tone.start()
    try { playerRef.current.stop() } catch {}

    const startPos = offset !== undefined ? offset : startOffsetRef.current
    startOffsetRef.current = Math.max(0, Math.min(startPos, durationRef.current - 0.05))
    startContextTimeRef.current = Tone.now()
    playingRef.current = true
    setPlaying(true)
    playerRef.current.start(Tone.now(), startOffsetRef.current)
    _startRaf()
  }, [])

  const pause = useCallback(() => {
    if (!playerRef.current || !playingRef.current) return
    const pos = startOffsetRef.current + (Tone.now() - startContextTimeRef.current) * speedRef.current
    startOffsetRef.current = Math.min(pos, durationRef.current)
    playingRef.current = false
    setPlaying(false)
    cancelAnimationFrame(rafRef.current)
    try { playerRef.current.stop() } catch {}
  }, [])

  const seek = useCallback((t) => {
    const clamped = Math.max(0, Math.min(t, durationRef.current))
    startOffsetRef.current = clamped
    setCurrentTime(clamped)
    if (playingRef.current && playerRef.current) {
      try { playerRef.current.stop() } catch {}
      startContextTimeRef.current = Tone.now()
      playerRef.current.start(Tone.now(), clamped)
      _startRaf()
    }
  }, [])

  const setSpeed = useCallback((s) => {
    const newSpeed = Math.max(0.5, Math.min(2, s))
    if (playingRef.current) {
      startOffsetRef.current += (Tone.now() - startContextTimeRef.current) * speedRef.current
      startContextTimeRef.current = Tone.now()
    }
    speedRef.current = newSpeed
    setSpeedState(newSpeed)
    if (playerRef.current) {
      playerRef.current.playbackRate = newSpeed
      if (pitchShiftRef.current) {
        // Keep user pitch; compensate for the semitone shift caused by playbackRate
        pitchShiftRef.current.pitch = pitchRef.current - 12 * Math.log2(newSpeed)
      }
    }
  }, [])

  const setPitch = useCallback((semitones) => {
    pitchRef.current = semitones
    setPitchState(semitones)
    if (pitchShiftRef.current) {
      pitchShiftRef.current.pitch = semitones - 12 * Math.log2(speedRef.current)
    }
  }, [])

  const setLoopPoints = useCallback((a, b) => {
    const newA = Math.max(0, Math.min(a, durationRef.current))
    const newB = Math.max(0, Math.min(b, durationRef.current))
    setLoopA(newA)
    setLoopB(newB)
    if (playerRef.current) {
      playerRef.current.loopStart = Math.min(newA, newB)
      playerRef.current.loopEnd = Math.max(newA, newB)
    }
  }, [])

  const setLoopEnabled = useCallback((enabled) => {
    setLoopEnabledState(enabled)
    if (playerRef.current) {
      playerRef.current.loop = enabled
    }
  }, [])

  // Explicitly pre-download a track into IndexedDB without playing it
  const downloadTrack = useCallback(async (trackId) => {
    const already = await isAudioCached(trackId)
    if (already) return
    const token = localStorage.getItem('token')
    const res = await fetch(`/api/tracks/${trackId}/stream`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    await cacheAudio(trackId, await res.arrayBuffer())
  }, [])

  const setVolume = useCallback((v) => {
    const clamped = Math.max(0, Math.min(1, v))
    setVolumeState(clamped)
    const db = clamped <= 0 ? -Infinity : 20 * Math.log10(Math.max(clamped, 0.0001))
    Tone.getDestination().volume.value = db
  }, [])

  // Resume AudioContext when app comes back to foreground (PWA / tab switch)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && playingRef.current) {
        Tone.start().then(() => _startRaf()).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      _dispose()
    }
  }, [])

  return {
    isLoading, isCached, peaks, duration, playing, currentTime,
    speed, pitch, loopEnabled, loopA, loopB, volume,
    loadTrack, downloadTrack, play, pause, seek,
    setSpeed, setPitch, setLoopPoints, setLoopEnabled, setVolume,
  }
}
