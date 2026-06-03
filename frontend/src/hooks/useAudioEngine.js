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
  const [loadedTrackId, setLoadedTrackId] = useState(null)

  const playerRef = useRef(null)
  const pitchShiftRef = useRef(null)
  const masterGainRef = useRef(null)
  const rafRef = useRef(null)
  const stemPlayersRef = useRef([])

  const startContextTimeRef = useRef(0)
  const startOffsetRef = useRef(0)
  const speedRef = useRef(1)
  const pitchValueRef = useRef(0)
  const playingRef = useRef(false)
  const durationRef = useRef(0)
  const loopARef = useRef(0)
  const loopBRef = useRef(0)
  const loopEnabledRef = useRef(false)

  function _getLinearTime() {
    return startOffsetRef.current + (Tone.now() - startContextTimeRef.current) * speedRef.current
  }

  function _getDisplayTime() {
    const t = _getLinearTime()
    if (loopEnabledRef.current && loopBRef.current > loopARef.current) {
      const la = loopARef.current
      const lb = loopBRef.current
      if (t >= la) {
        return la + ((t - la) % (lb - la))
      }
    }
    return t
  }

  function _disposeStemPlayers() {
    stemPlayersRef.current.forEach(({ player, gainNode }) => {
      try { player.stop() } catch {}
      try { player.dispose() } catch {}
      try { gainNode.dispose() } catch {}
    })
    stemPlayersRef.current = []
  }

  function _dispose() {
    cancelAnimationFrame(rafRef.current)
    try { playerRef.current?.stop() } catch {}
    playerRef.current?.dispose()
    pitchShiftRef.current?.dispose()
    masterGainRef.current?.dispose()
    _disposeStemPlayers()
    playerRef.current = null
    pitchShiftRef.current = null
    masterGainRef.current = null
    setPlaying(false)
    playingRef.current = false
    setCurrentTime(0)
    startOffsetRef.current = 0
    setLoadedTrackId(null)
  }

  function _startRaf() {
    cancelAnimationFrame(rafRef.current)
    const tick = () => {
      if (!playingRef.current) return
      const t = _getDisplayTime()
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
    pitchValueRef.current = 0
    setSpeedState(1)
    speedRef.current = 1
    setLoopEnabledState(false)
    loopEnabledRef.current = false
    setLoopA(0)
    setLoopB(0)
    loopARef.current = 0
    loopBRef.current = 0

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
      loopBRef.current = dur
      setPeaks(extractPeaks(webAudioBuffer))

      const toneBuffer = new Tone.ToneAudioBuffer(webAudioBuffer)
      // masterGain lets us mute the full mix when stems are active
      const masterGain = new Tone.Volume(0).toDestination()
      const pitchShift = new Tone.PitchShift(0).connect(masterGain)
      pitchShift.wet.value = 1
      const player = new Tone.Player(toneBuffer).connect(pitchShift)
      player.playbackRate = 1

      player.onstop = () => {
        if (playingRef.current) {
          const pos = _getDisplayTime()
          if (pos >= durationRef.current - 0.15) {
            cancelAnimationFrame(rafRef.current)
            setPlaying(false)
            playingRef.current = false
            setCurrentTime(durationRef.current)
          }
        }
      }

      masterGainRef.current = masterGain
      pitchShiftRef.current = pitchShift
      playerRef.current = player
      setLoadedTrackId(trackId)
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
    stemPlayersRef.current.forEach(({ player }) => {
      try { player.stop() } catch {}
      player.playbackRate = speedRef.current
      player.start(Tone.now(), startOffsetRef.current)
    })
    _startRaf()
  }, [])

  const pause = useCallback(() => {
    if (!playerRef.current || !playingRef.current) return
    startOffsetRef.current = Math.min(_getDisplayTime(), durationRef.current)
    playingRef.current = false
    setPlaying(false)
    cancelAnimationFrame(rafRef.current)
    try { playerRef.current.stop() } catch {}
    stemPlayersRef.current.forEach(({ player }) => { try { player.stop() } catch {} })
  }, [])

  const seek = useCallback((t) => {
    const clamped = Math.max(0, Math.min(t, durationRef.current))
    startOffsetRef.current = clamped
    startContextTimeRef.current = Tone.now()
    setCurrentTime(clamped)
    if (playingRef.current && playerRef.current) {
      try { playerRef.current.stop() } catch {}
      playerRef.current.start(Tone.now(), clamped)
      stemPlayersRef.current.forEach(({ player }) => {
        try { player.stop() } catch {}
        player.playbackRate = speedRef.current
        player.start(Tone.now(), clamped)
      })
      _startRaf()
    }
  }, [])

  // Change speed dynamically without restarting — updates playbackRate on all active players
  const setSpeed = useCallback((s) => {
    const newSpeed = Math.max(0.5, Math.min(2, s))
    if (playingRef.current) {
      startOffsetRef.current = _getDisplayTime()
      startContextTimeRef.current = Tone.now()
    }
    speedRef.current = newSpeed
    setSpeedState(newSpeed)
    if (playerRef.current) playerRef.current.playbackRate = newSpeed
    if (pitchShiftRef.current) {
      pitchShiftRef.current.pitch = pitchValueRef.current - 12 * Math.log2(newSpeed)
    }
    stemPlayersRef.current.forEach(({ player }) => {
      player.playbackRate = newSpeed
    })
  }, [])

  // Change pitch dynamically via PitchShift node — no audio restart needed
  const setPitch = useCallback((semitones) => {
    pitchValueRef.current = semitones
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
    loopARef.current = newA
    loopBRef.current = newB
    if (playerRef.current) {
      playerRef.current.loopStart = Math.min(newA, newB)
      playerRef.current.loopEnd = Math.max(newA, newB)
    }
  }, [])

  const setLoopEnabled = useCallback((enabled) => {
    setLoopEnabledState(enabled)
    loopEnabledRef.current = enabled
    if (playerRef.current) {
      playerRef.current.loop = enabled
    }
    if (!enabled && playingRef.current) {
      startOffsetRef.current = _getDisplayTime()
      startContextTimeRef.current = Tone.now()
    }
  }, [])

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      _dispose()
    }
  }, [])

  const loadStems = useCallback(async (stems) => {
    _disposeStemPlayers()
    const token = localStorage.getItem('token')
    for (const stem of stems) {
      try {
        const res = await fetch(`/api/stems/${stem.id}/stream`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) continue
        const arrayBuffer = await res.arrayBuffer()
        const webAudioBuffer = await Tone.context.rawContext.decodeAudioData(arrayBuffer)
        const toneBuffer = new Tone.ToneAudioBuffer(webAudioBuffer)
        const gainNode = new Tone.Volume(stem.volume <= 0 ? -Infinity : 20 * Math.log10(stem.volume))
        gainNode.toDestination()
        const player = new Tone.Player(toneBuffer).connect(gainNode)
        stemPlayersRef.current.push({ id: stem.id, player, gainNode })
      } catch (e) {
        console.error('Stem load error:', e)
      }
    }
    // Mute the full-mix track when stems are active so they don't double up
    if (masterGainRef.current) {
      masterGainRef.current.volume.value = stems.length > 0 ? -Infinity : 0
    }
  }, [])

  const setStemVolume = useCallback((stemId, volume) => {
    const s = stemPlayersRef.current.find((s) => s.id === stemId)
    if (s) s.gainNode.volume.value = volume <= 0 ? -Infinity : 20 * Math.log10(volume)
  }, [])

  return {
    isLoading, peaks, duration, playing, currentTime,
    speed, pitch, loopEnabled, loopA, loopB, loadedTrackId,
    loadTrack, loadStems, setStemVolume, play, pause, seek,
    setSpeed, setPitch, setLoopPoints, setLoopEnabled,
  }
}
