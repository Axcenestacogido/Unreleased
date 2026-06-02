import { useRef, useState, useCallback, useEffect } from 'react'
import * as Tone from 'tone'

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

  const playerRef = useRef(null)
  const pitchShiftRef = useRef(null)
  const rafRef = useRef(null)

  // Refs for time tracking (avoid stale closures in rAF)
  const startContextTimeRef = useRef(0)
  const startOffsetRef = useRef(0)
  const speedRef = useRef(1)
  const playingRef = useRef(false)
  const durationRef = useRef(0)

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
      const clamped = Math.min(Math.max(t, 0), durationRef.current)
      setCurrentTime(clamped)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const loadTrack = useCallback(async (trackId) => {
    _dispose()
    setIsLoading(true)
    setPeaks([])
    setDuration(0)
    setCurrentTime(0)
    setPitchState(0)
    setSpeedState(1)
    speedRef.current = 1
    setLoopEnabledState(false)
    setLoopA(0)
    setLoopB(0)

    try {
      await Tone.start()
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/tracks/${trackId}/stream`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Stream failed')
      const arrayBuffer = await res.arrayBuffer()
      const webAudioBuffer = await Tone.context.rawContext.decodeAudioData(arrayBuffer)

      const dur = webAudioBuffer.duration
      setDuration(dur)
      durationRef.current = dur
      setLoopB(dur)
      setPeaks(extractPeaks(webAudioBuffer))

      const toneBuffer = new Tone.ToneAudioBuffer(webAudioBuffer)
      const pitchShift = new Tone.PitchShift(0).toDestination()
      const player = new Tone.Player(toneBuffer).connect(pitchShift)
      player.playbackRate = 1

      player.onstop = () => {
        // Only mark done if we played to the end (not a seek stop)
        if (playingRef.current) {
          const pos = startOffsetRef.current + (Tone.now() - startContextTimeRef.current) * speedRef.current
          if (pos >= durationRef.current - 0.1) {
            cancelAnimationFrame(rafRef.current)
            setPlaying(false)
            playingRef.current = false
            setCurrentTime(durationRef.current)
          }
        }
      }

      pitchShiftRef.current = pitchShift
      playerRef.current = player
    } catch (err) {
      console.error('Audio load error:', err)
    } finally {
      setIsLoading(false)
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
    // Capture position before stopping
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
    // Update offset before changing speed to keep position accurate
    if (playingRef.current) {
      startOffsetRef.current += (Tone.now() - startContextTimeRef.current) * speedRef.current
      startContextTimeRef.current = Tone.now()
    }
    speedRef.current = newSpeed
    setSpeedState(newSpeed)
    if (playerRef.current) {
      playerRef.current.playbackRate = newSpeed
      // Recompute pitch compensation
      if (pitchShiftRef.current) {
        const userPitch = pitchShiftRef.current.pitch + 12 * Math.log2(speedRef.current === newSpeed ? 1 : speedRef.current / newSpeed)
        pitchShiftRef.current.pitch = userPitch - 12 * Math.log2(newSpeed)
      }
    }
  }, [])

  const setPitch = useCallback((semitones) => {
    setPitchState(semitones)
    if (pitchShiftRef.current) {
      // Compensate for speed: playbackRate adds 12*log2(speed) semitones of pitch
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

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      _dispose()
    }
  }, [])

  return {
    isLoading, peaks, duration, playing, currentTime,
    speed, pitch, loopEnabled, loopA, loopB,
    loadTrack, play, pause, seek,
    setSpeed, setPitch, setLoopPoints, setLoopEnabled,
  }
}
