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

function linearToDb(gain) {
  return gain >= 0.001 ? 20 * Math.log10(gain) : -Infinity
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
  const rafRef = useRef(null)
  // stemPlayersRef: { [stemId]: Tone.Player }
  const stemPlayersRef = useRef({})
  // Counter of pending manual stops — each _markManualStop() call must be matched by one onstop
  const manualStopRef = useRef(0)
  // Set to true when loadStems is called with stems present, even before playerRef exists.
  // Lets loadTrack mute the player immediately if stems were pre-loaded (race condition guard).
  const stemsShouldMuteRef = useRef(false)

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

  // Increment before each manual stop(); onstop decrements and skips end-of-track logic
  function _markManualStop() {
    manualStopRef.current++
  }

  function _stopStemPlayers() {
    Object.values(stemPlayersRef.current).forEach(p => { try { p.stop() } catch {} })
  }

  function _startStemPlayers(atTime, offset) {
    Object.values(stemPlayersRef.current).forEach(p => {
      const stemDur = p.buffer?.duration ?? durationRef.current
      const stemOff = Math.max(0, Math.min(offset, stemDur - 0.05))
      try { p.start(atTime, stemOff) } catch {}
    })
  }

  function _dispose() {
    cancelAnimationFrame(rafRef.current)
    _markManualStop()
    try { playerRef.current?.stop() } catch {}
    playerRef.current?.dispose()
    pitchShiftRef.current?.dispose()
    playerRef.current = null
    pitchShiftRef.current = null
    Object.values(stemPlayersRef.current).forEach(p => {
      try { p.stop() } catch {}
      p.dispose()
    })
    stemPlayersRef.current = {}
    stemsShouldMuteRef.current = false
    setPlaying(false)
    playingRef.current = false
    setCurrentTime(0)
    startOffsetRef.current = 0
  }

  function _startRaf() {
    cancelAnimationFrame(rafRef.current)
    const tick = () => {
      if (!playingRef.current) return

      // Enforce loop end: restart audio at loopA when linear time reaches loopB
      if (loopEnabledRef.current && loopBRef.current > loopARef.current) {
        const linearT = _getLinearTime()
        if (linearT >= loopBRef.current) {
          const loopStart = loopARef.current
          startOffsetRef.current = loopStart
          _markManualStop()
          try { playerRef.current?.stop() } catch {}
          _stopStemPlayers()
          const now = Tone.now()
          startContextTimeRef.current = now
          try { playerRef.current?.start(now, loopStart) } catch {}
          _startStemPlayers(now, loopStart)
          setCurrentTime(loopStart)
          rafRef.current = requestAnimationFrame(tick)
          return
        }
      }

      const t = _getDisplayTime()
      const clamped = Math.min(Math.max(t, 0), durationRef.current)
      setCurrentTime(clamped)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  // Stop and restart from current display position (avoids audio doubling after param changes)
  function _restartIfPlaying() {
    if (!playingRef.current || !playerRef.current) return
    const pos = _getDisplayTime()
    startOffsetRef.current = Math.max(0, Math.min(pos, durationRef.current - 0.05))
    _markManualStop()
    try { playerRef.current.stop() } catch {}
    _stopStemPlayers()
    const now = Tone.now()
    startContextTimeRef.current = now
    playerRef.current.start(now, startOffsetRef.current)
    _startStemPlayers(now, startOffsetRef.current)
    _startRaf()
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
      const pitchShift = new Tone.PitchShift(0).toDestination()
      pitchShift.wet.value = 1
      const player = new Tone.Player(toneBuffer).connect(pitchShift)
      player.playbackRate = 1

      // JS-managed loop and end-detection via onstop.
      // We don't rely on player.loop (AudioBufferSourceNode native loop) because
      // it has inconsistent behavior across browsers at loopEnd = buffer.duration.
      player.onstop = () => {
        // Ignore stops triggered by our own seek/pause/dispose calls
        if (manualStopRef.current > 0) {
          manualStopRef.current--
          return
        }
        if (!playingRef.current) return

        if (loopEnabledRef.current && loopBRef.current > loopARef.current) {
          // Loop: restart from loopA, keep RAF going
          const loopStart = loopARef.current
          const now = Tone.now()
          startOffsetRef.current = loopStart
          startContextTimeRef.current = now
          try { player.start(now, loopStart) } catch {}
          _startStemPlayers(now, loopStart)
          return
        }

        // End of track
        cancelAnimationFrame(rafRef.current)
        setPlaying(false)
        playingRef.current = false
        setCurrentTime(durationRef.current)
      }

      pitchShiftRef.current = pitchShift
      playerRef.current = player
      // Race condition: loadStems may have run while playerRef was null.
      // stemsShouldMuteRef captures that intent so we mute immediately.
      if (stemsShouldMuteRef.current || Object.keys(stemPlayersRef.current).length > 0) {
        player.volume.value = -Infinity
      }
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
    _markManualStop()
    try { playerRef.current.stop() } catch {}
    _stopStemPlayers()

    const startPos = offset !== undefined ? offset : startOffsetRef.current
    startOffsetRef.current = Math.max(0, Math.min(startPos, durationRef.current - 0.05))
    playingRef.current = true
    setPlaying(true)
    // Capture Tone.now() once so main player and stems start at the same scheduled time
    const startAt = Tone.now()
    startContextTimeRef.current = startAt
    playerRef.current.start(startAt, startOffsetRef.current)
    _startStemPlayers(startAt, startOffsetRef.current)
    _startRaf()
  }, [])

  const pause = useCallback(() => {
    if (!playerRef.current || !playingRef.current) return
    startOffsetRef.current = Math.min(_getDisplayTime(), durationRef.current)
    playingRef.current = false
    setPlaying(false)
    cancelAnimationFrame(rafRef.current)
    _markManualStop()
    try { playerRef.current.stop() } catch {}
    _stopStemPlayers()
  }, [])

  const seek = useCallback((t) => {
    const clamped = Math.max(0, Math.min(t, durationRef.current))
    startOffsetRef.current = clamped
    setCurrentTime(clamped)
    if (playingRef.current && playerRef.current) {
      _markManualStop()
      try { playerRef.current.stop() } catch {}
      _stopStemPlayers()
      const startAt = Tone.now()
      startContextTimeRef.current = startAt
      playerRef.current.start(startAt, clamped)
      _startStemPlayers(startAt, clamped)
      _startRaf()
    } else {
      startContextTimeRef.current = Tone.now()
    }
  }, [])

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
    Object.values(stemPlayersRef.current).forEach(p => { p.playbackRate = newSpeed })
  }, [])

  const setPitch = useCallback((semitones) => {
    pitchValueRef.current = semitones
    setPitchState(semitones)
    if (!pitchShiftRef.current) return
    // Update pitch directly — avoids the stop+restart click artifact.
    // The brief granular overlap (~100ms) is less disruptive than cutting out.
    pitchShiftRef.current.pitch = semitones - 12 * Math.log2(speedRef.current)
  }, [])

  const setLoopPoints = useCallback((a, b) => {
    const newA = Math.max(0, Math.min(a, durationRef.current))
    const newB = Math.max(0, Math.min(b, durationRef.current))
    setLoopA(newA)
    setLoopB(newB)
    loopARef.current = newA
    loopBRef.current = newB
  }, [])

  const setLoopEnabled = useCallback((enabled) => {
    setLoopEnabledState(enabled)
    loopEnabledRef.current = enabled
    // Reset time tracking when toggling loop off so position stays accurate
    if (!enabled && playingRef.current) {
      startOffsetRef.current = _getDisplayTime()
      startContextTimeRef.current = Tone.now()
    }
  }, [])

  // PWA background audio: keep audio session alive through screen lock.
  // iOS only continues audio for HTML5 <audio> elements, not Web Audio API alone.
  // We generate a 1-second silent WAV as a blob URL and loop it at near-zero volume.
  // Once the user first interacts, this registers an active audio session so iOS
  // doesn't suspend the Tone.js AudioContext when the screen locks.
  useEffect(() => {
    let silentAudio = null
    let blobUrl = null

    const startKeepAlive = () => {
      if (silentAudio) return
      // Build a minimal 1s silent WAV (8000Hz, 8-bit, mono) programmatically
      const sampleRate = 8000
      const numSamples = sampleRate
      const dataSize = numSamples // 1 byte per sample (8-bit)
      const buf = new ArrayBuffer(44 + dataSize)
      const v = new DataView(buf)
      const str = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)) }
      str(0, 'RIFF'); v.setUint32(4, 36 + dataSize, true); str(8, 'WAVE')
      str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true)
      v.setUint16(22, 1, true); v.setUint32(24, sampleRate, true)
      v.setUint32(28, sampleRate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true)
      str(36, 'data'); v.setUint32(40, dataSize, true)
      // 8-bit PCM silence = 128 (midpoint of unsigned range)
      new Uint8Array(buf).fill(128, 44)
      blobUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
      silentAudio = new Audio(blobUrl)
      silentAudio.loop = true
      silentAudio.volume = 0.001
      silentAudio.play().catch(() => {})
      document.removeEventListener('touchstart', startKeepAlive)
      document.removeEventListener('mousedown', startKeepAlive)
    }

    // Resume AudioContext when returning to foreground
    const handleVisibility = () => {
      if (!document.hidden && Tone.context.state !== 'running') {
        Tone.context.resume()
      }
    }
    // Also resume on pageshow (iOS fires this when returning from background)
    const handlePageShow = () => Tone.context.state !== 'running' && Tone.context.resume()

    document.addEventListener('touchstart', startKeepAlive, { passive: true })
    document.addEventListener('mousedown', startKeepAlive)
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pageshow', handlePageShow)

    return () => {
      document.removeEventListener('touchstart', startKeepAlive)
      document.removeEventListener('mousedown', startKeepAlive)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pageshow', handlePageShow)
      if (silentAudio) { silentAudio.pause(); silentAudio.src = '' }
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [])

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      _dispose()
    }
  }, [])

  const loadStems = useCallback(async (stems) => {
    if (!stems) return

    const currentIds = new Set(Object.keys(stemPlayersRef.current).map(Number))
    const newStemsMap = new Map(stems.map(s => [s.id, s]))

    // Dispose players for stems that no longer exist
    for (const [id, player] of Object.entries(stemPlayersRef.current)) {
      if (!newStemsMap.has(Number(id))) {
        try { player.stop() } catch {}
        player.dispose()
        delete stemPlayersRef.current[id]
      }
    }

    // Signal mute intent before any async work. loadTrack checks this ref
    // so it can mute immediately even if it finishes before stems are added to stemPlayersRef.
    stemsShouldMuteRef.current = stems.length > 0

    // Mute/unmute main player immediately based on whether stems will be present.
    if (playerRef.current) {
      playerRef.current.volume.value = stems.length > 0 ? -Infinity : 0
    }

    // Load new stems (ones not already loaded)
    const toLoad = stems.filter(s => !currentIds.has(s.id))

    if (toLoad.length > 0) {
      const token = localStorage.getItem('token')

      await Promise.all(toLoad.map(async (stem) => {
        try {
          await Tone.start()
          const res = await fetch(`/api/stems/${stem.id}/stream`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (!res.ok) throw new Error(`Stem stream failed: ${res.status}`)
          const ab = await res.arrayBuffer()
          const decoded = await Tone.context.rawContext.decodeAudioData(ab)
          const buf = new Tone.ToneAudioBuffer(decoded)

          const player = new Tone.Player(buf).toDestination()
          player.playbackRate = speedRef.current
          player.volume.value = linearToDb(stem.volume ?? 1)

          stemPlayersRef.current[stem.id] = player

          // If main track is already playing, join in at the current position
          if (playingRef.current) {
            const pos = Math.max(0, Math.min(_getDisplayTime(), decoded.duration - 0.05))
            player.start(Tone.now(), pos)
          }
        } catch (err) {
          console.error(`Stem ${stem.id} load error:`, err)
        }
      }))

      // Re-apply mute after loading in case loadTrack completed during our async work
      if (playerRef.current) {
        playerRef.current.volume.value = stems.length > 0 ? -Infinity : 0
      }
    }

  }, [])

  const setStemVolume = useCallback((stemId, volume) => {
    const player = stemPlayersRef.current[stemId]
    if (player) {
      player.volume.value = linearToDb(volume)
    }
  }, [])

  return {
    isLoading, peaks, duration, playing, currentTime,
    speed, pitch, loopEnabled, loopA, loopB,
    loadedTrackId,
    loadTrack, play, pause, seek,
    setSpeed, setPitch, setLoopPoints, setLoopEnabled,
    loadStems, setStemVolume,
  }
}
