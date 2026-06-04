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
  const rafRef = useRef(null)

  // Stem players: { [stemId]: { player: Tone.Player, volNode: Tone.Volume } }
  const stemPlayersRef = useRef({})
  const stemsActiveRef = useRef(false)
  const loadedStemIdsRef = useRef(new Set())

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

  function _stopStemPlayers() {
    Object.values(stemPlayersRef.current).forEach(({ player }) => {
      try { player.stop() } catch {}
    })
  }

  function _startStemPlayers(offset) {
    Tone.context.resume().catch(() => {})
    const safe = Math.max(0, Math.min(offset, durationRef.current - 0.05))
    Object.values(stemPlayersRef.current).forEach(({ player }) => {
      try { player.stop() } catch {}
      try { player.start(Tone.now(), safe) } catch {}
    })
  }

  function _disposeStemPlayers() {
    Object.values(stemPlayersRef.current).forEach(({ player, gainNode }) => {
      try { player.stop() } catch {}
      try { player.dispose() } catch {}
      try { gainNode.dispose() } catch {}
    })
    stemPlayersRef.current = {}
    stemsActiveRef.current = false
    loadedStemIdsRef.current = new Set()
  }

  function _dispose() {
    cancelAnimationFrame(rafRef.current)
    try { playerRef.current?.stop() } catch {}
    playerRef.current?.dispose()
    pitchShiftRef.current?.dispose()
    playerRef.current = null
    pitchShiftRef.current = null
    _disposeStemPlayers()
    setPlaying(false)
    playingRef.current = false
    setCurrentTime(0)
    startOffsetRef.current = 0
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
      // Original chain: player → pitchShift → output
      // When stems are active we set player.mute = true so only stems are heard
      const pitchShift = new Tone.PitchShift(0).toDestination()
      pitchShift.wet.value = 1
      const player = new Tone.Player(toneBuffer).connect(pitchShift)
      player.playbackRate = 1
      // Apply mute immediately if stems are already loaded for this session
      player.mute = stemsActiveRef.current

      player.onstop = () => {
        if (playingRef.current) {
          const pos = _getDisplayTime()
          if (pos >= durationRef.current - 0.15) {
            cancelAnimationFrame(rafRef.current)
            setPlaying(false)
            playingRef.current = false
            setCurrentTime(durationRef.current)
            _stopStemPlayers()
          }
        }
      }

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

    if (stemsActiveRef.current) {
      _startStemPlayers(startOffsetRef.current)
    }
    _startRaf()
  }, [])

  const pause = useCallback(() => {
    if (!playerRef.current || !playingRef.current) return
    startOffsetRef.current = Math.min(_getDisplayTime(), durationRef.current)
    playingRef.current = false
    setPlaying(false)
    cancelAnimationFrame(rafRef.current)
    try { playerRef.current.stop() } catch {}
    _stopStemPlayers()
  }, [])

  const seek = useCallback((t) => {
    const clamped = Math.max(0, Math.min(t, durationRef.current))
    startOffsetRef.current = clamped
    startContextTimeRef.current = Tone.now()
    setCurrentTime(clamped)
    if (playingRef.current && playerRef.current) {
      try { playerRef.current.stop() } catch {}
      playerRef.current.start(Tone.now(), clamped)
      if (stemsActiveRef.current) {
        _startStemPlayers(clamped)
      }
      _startRaf()
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
    Object.values(stemPlayersRef.current).forEach(({ player }) => {
      player.playbackRate = newSpeed
    })
  }, [])

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
    Object.values(stemPlayersRef.current).forEach(({ player }) => {
      player.loopStart = Math.min(newA, newB)
      player.loopEnd = Math.max(newA, newB)
    })
  }, [])

  const setLoopEnabled = useCallback((enabled) => {
    setLoopEnabledState(enabled)
    loopEnabledRef.current = enabled
    if (playerRef.current) playerRef.current.loop = enabled
    Object.values(stemPlayersRef.current).forEach(({ player }) => {
      player.loop = enabled
    })
    if (!enabled && playingRef.current && playerRef.current) {
      const pos = _getDisplayTime()
      startOffsetRef.current = pos
      startContextTimeRef.current = Tone.now()
      try { playerRef.current.stop() } catch {}
      playerRef.current.start(Tone.now(), pos)
      if (stemsActiveRef.current) {
        _startStemPlayers(pos)
      }
      _startRaf()
    }
  }, [])

  const loadStems = useCallback(async (stems) => {
    if (!stems || stems.length === 0) {
      _disposeStemPlayers()
      // Unmute main player
      if (playerRef.current) playerRef.current.mute = false
      return
    }

    const newIds = new Set(stems.map((s) => s.id))
    const sameSet =
      newIds.size === loadedStemIdsRef.current.size &&
      [...newIds].every((id) => loadedStemIdsRef.current.has(id)) &&
      stems.every((s) => stemPlayersRef.current[s.id]?.fileSize === s.file_size)

    if (sameSet) {
      // Same stems (same files) — just sync gain values
      stems.forEach((stem) => {
        const entry = stemPlayersRef.current[stem.id]
        if (entry) entry.gainNode.gain.value = Math.max(0, Math.min(1, stem.volume))
      })
      return
    }

    _disposeStemPlayers()

    const token = localStorage.getItem('token')
    const rawCtx = Tone.context.rawContext // needed for decodeAudioData

    const results = await Promise.all(
      stems.map(async (stem) => {
        try {
          const res = await fetch(`/api/stems/${stem.id}/stream`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (!res.ok) {
            console.error(`Stem ${stem.id} stream failed: ${res.status}`)
            return null
          }
          const buf = await res.arrayBuffer()
          const webBuf = await rawCtx.decodeAudioData(buf)
          const toneBuf = new Tone.ToneAudioBuffer(webBuf)

          const gainNode = new Tone.Gain(Math.max(0, Math.min(1, stem.volume))).toDestination()
          const player = new Tone.Player(toneBuf).connect(gainNode)
          player.playbackRate = speedRef.current
          player.loop = loopEnabledRef.current
          player.loopStart = loopARef.current
          player.loopEnd = loopBRef.current
          return { stemId: stem.id, player, gainNode, fileSize: stem.file_size }
        } catch (e) {
          console.error(`Stem ${stem.id} load error:`, e)
          return null
        }
      })
    )

    const newPlayers = {}
    results.forEach((entry) => {
      if (entry) newPlayers[entry.stemId] = { player: entry.player, gainNode: entry.gainNode, fileSize: entry.fileSize }
    })

    if (Object.keys(newPlayers).length === 0) return

    stemPlayersRef.current = newPlayers
    stemsActiveRef.current = true
    loadedStemIdsRef.current = newIds

    // Mute main player — stems provide the audio
    if (playerRef.current) playerRef.current.mute = true

    // If already playing, start stem players from current position
    if (playingRef.current) {
      _startStemPlayers(_getDisplayTime())
    }
  }, [])

  const setStemVolume = useCallback((stemId, volume) => {
    const entry = stemPlayersRef.current[stemId]
    if (entry) entry.gainNode.gain.value = Math.max(0, Math.min(1, volume))
  }, [])

  useEffect(() => {
    // iOS PWA background audio:
    // A looping <audio> element bridged into the Web Audio graph via
    // createMediaElementSource keeps iOS from treating the AudioContext as
    // an "ambient" (screen-off-suspended) session. volume=0 alone is NOT
    // enough — iOS ignores muted elements for session classification purposes.
    let silentAudio = null
    let silentUrl = null

    function _startSilentAudio() {
      if (silentAudio) return
      try {
        const rawCtx = Tone.context.rawContext
        // 1-second silent 8kHz 8-bit mono WAV
        const sr = 8000, n = 8000
        const buf = new ArrayBuffer(44 + n)
        const dv = new DataView(buf)
        dv.setUint32(0,  0x52494646, false) // "RIFF"
        dv.setUint32(4,  36 + n,     true)
        dv.setUint32(8,  0x57415645, false) // "WAVE"
        dv.setUint32(12, 0x666D7420, false) // "fmt "
        dv.setUint32(16, 16, true)
        dv.setUint16(20, 1,  true)  // PCM
        dv.setUint16(22, 1,  true)  // mono
        dv.setUint32(24, sr, true)  // sample rate
        dv.setUint32(28, sr, true)  // byte rate
        dv.setUint16(32, 1,  true)  // block align
        dv.setUint16(34, 8,  true)  // bits per sample
        dv.setUint32(36, 0x64617461, false) // "data"
        dv.setUint32(40, n,  true)
        new Uint8Array(buf, 44).fill(128) // unsigned 8-bit silence = 128

        silentUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
        silentAudio = document.createElement('audio')
        silentAudio.src = silentUrl
        silentAudio.loop = true

        // Bridge the audio element into the Web Audio API.
        // iOS sees a MediaElementSourceNode as "active media" and keeps
        // the AudioContext running when the screen locks.
        try {
          const src = rawCtx.createMediaElementSource(silentAudio)
          src.connect(rawCtx.destination)
        } catch {}

        silentAudio.play().catch(() => {})
      } catch (e) {
        console.warn('keepalive audio init failed:', e)
      }
    }

    const unlock = async () => {
      await Tone.start()
      _startSilentAudio()
    }
    document.addEventListener('click', unlock, { once: true })
    document.addEventListener('touchstart', unlock, { once: true, passive: true })

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        Tone.context.resume().catch(() => {})
        if (silentAudio) silentAudio.play().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      if (silentAudio) { silentAudio.pause(); silentAudio.src = '' }
      if (silentUrl) URL.revokeObjectURL(silentUrl)
      cancelAnimationFrame(rafRef.current)
      _dispose()
      document.removeEventListener('click', unlock)
      document.removeEventListener('touchstart', unlock)
      document.removeEventListener('visibilitychange', handleVisibility)
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
