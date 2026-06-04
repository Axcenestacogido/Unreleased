import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Play, Pause, SkipBack, SkipForward,
  Repeat, Disc3, Music2, ChevronDown,
  Plus, Trash2, Loader2, Zap, Scissors,
  FileText, SlidersHorizontal, X,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePlayer } from '../../hooks/usePlayer'
import { useAudioEngine } from '../../hooks/useAudioEngine'
import api from '../../api/client'
import WaveCanvas from './WaveCanvas'

function fmt(s) {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function Slider({ value, min, max, step, onChange, onReset }) {
  const trackRef = useRef(null)
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))

  const getVal = useCallback((e) => {
    const rect = trackRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    return min + ratio * (max - min)
  }, [min, max])

  const handlePointerDown = useCallback((e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    onChange(getVal(e))
  }, [getVal, onChange])

  const handlePointerMove = useCallback((e) => {
    if (e.buttons === 0) return
    onChange(getVal(e))
  }, [getVal, onChange])

  return (
    <div ref={trackRef} onDoubleClick={onReset}
      onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
      style={{ position: 'relative', height: 18, cursor: 'ew-resize', display: 'flex', alignItems: 'center', touchAction: 'none' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'var(--waveform-inactive)', borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 2, background: 'var(--accent)', borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: `${pct}%`, width: 12, height: 12, marginLeft: -6, borderRadius: '50%', background: 'var(--accent)' }} />
    </div>
  )
}

function IconBtn({ onClick, children, active, size = 32, title }) {
  const [hover, setHover] = useState(false)
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: size, height: size, borderRadius: '50%', border: 'none',
        background: active ? 'var(--accent-subtle)' : hover ? 'var(--bg-tertiary)' : 'transparent',
        color: active ? 'var(--text-primary)' : hover ? 'var(--text-primary)' : 'var(--text-secondary)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: `all var(--dur-hover) var(--ease)`, flexShrink: 0,
      }}>{children}</button>
  )
}

// Vertical fader for the stems mixer view
function VerticalFader({ value, onChange, onReset }) {
  const trackRef = useRef(null)
  const pct = (1 - Math.max(0, Math.min(1, value))) * 100 // 0% = top (max), 100% = bottom (min)

  const getVal = useCallback((e) => {
    const rect = trackRef.current.getBoundingClientRect()
    return 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
  }, [])

  const handlePointerDown = useCallback((e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    onChange(getVal(e))
  }, [getVal, onChange])

  const handlePointerMove = useCallback((e) => {
    if (e.buttons === 0) return
    onChange(getVal(e))
  }, [getVal, onChange])

  return (
    <div ref={trackRef}
      onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
      onDoubleClick={onReset}
      style={{ flex: 1, position: 'relative', cursor: 'ns-resize', touchAction: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      {/* Tick lines */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: 8, right: 8, top: `${(i / 11) * 100}%`, height: 1.5, borderRadius: 1, pointerEvents: 'none', background: i / 11 >= pct / 100 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.12)' }} />
      ))}
      {/* Fader handle */}
      <div style={{ position: 'absolute', top: `${pct}%`, left: 0, right: 0, transform: 'translateY(-50%)', height: 4, background: 'white', borderRadius: 2, pointerEvents: 'none', boxShadow: '0 1px 6px rgba(0,0,0,0.5)' }} />
    </div>
  )
}

// Slider for the mobile edit view — dark pill style with label + value
function EditSlider({ label, value, display, min, max, onChange, onReset }) {
  const trackRef = useRef(null)

  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))

  const getVal = useCallback((e) => {
    const rect = trackRef.current.getBoundingClientRect()
    return min + Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * (max - min)
  }, [min, max])

  const handlePointerDown = useCallback((e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    onChange(getVal(e))
  }, [getVal, onChange])

  const handlePointerMove = useCallback((e) => {
    if (e.buttons === 0) return
    onChange(getVal(e))
  }, [getVal, onChange])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-secondary)', borderRadius: 12, padding: '14px 16px' }}>
      <span style={{ width: 44, fontSize: 14, color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      <div ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onDoubleClick={onReset}
        style={{ flex: 1, position: 'relative', height: 28, cursor: 'ew-resize', display: 'flex', alignItems: 'center', touchAction: 'none' }}
      >
        {/* Tick marks */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 4,
          background: 'repeating-linear-gradient(90deg, transparent 0, transparent calc(10% - 1px), rgba(255,255,255,0.12) calc(10% - 1px), rgba(255,255,255,0.12) 10%)',
        }} />
        {/* Thumb — vertical bar like the screenshot */}
        <div style={{
          position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)',
          width: 3, height: 22, background: '#fff', borderRadius: 2,
          boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }} />
      </div>
      <span style={{ width: 48, fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{display}</span>
    </div>
  )
}

function PlayerContent({ engine, currentTrack, playNext, playPrev, onClose, isMobile }) {
  const qc = useQueryClient()

  const [activeTab, setActiveTab] = useState('edit')
  const [mobileTab, setMobileTab] = useState(null)
  const [editSubTab, setEditSubTab] = useState('adjust')
  const [loopActive, setLoopActive] = useState(false)
  const [loopPressing, setLoopPressing] = useState(false)
  const [loopA, setLoopA] = useState(null)
  const [loopB, setLoopB] = useState(null)

  const [bpm, setBpm] = useState('')
  const [key, setKey] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [separating, setSeparating] = useState(false)
  const [stemVolumes, setStemVolumes] = useState({})
  const saveTimeout = useRef(null)
  const stemInputRef = useRef(null)
  const wasPlayingRef = useRef(false)
  const loopPressARef = useRef(null)

  // Fetch stems via query so SSE invalidation triggers a refresh
  const { data: stems = [] } = useQuery({
    queryKey: ['stems', currentTrack?.id],
    queryFn: () => api.get(`/tracks/${currentTrack.id}/stems`).then(r => r.data),
    enabled: !!currentTrack,
  })

  // onSuccess was removed in React Query v5 — use a separate effect instead
  useEffect(() => {
    if (stems.length > 0 && separating) setSeparating(false)
    setStemVolumes(prev => {
      const next = { ...prev }
      stems.forEach(s => { if (next[s.id] === undefined) next[s.id] = s.volume })
      return next
    })
  }, [stems])

  useEffect(() => {
    if (!currentTrack) return
    setBpm(currentTrack.bpm != null ? String(currentTrack.bpm) : '')
    setKey(currentTrack.key_signature || '')
    setLyrics(currentTrack.lyrics || '')
    setSeparating(false)
  }, [currentTrack?.id])

  // Sync stems to audio engine whenever they change
  useEffect(() => {
    if (!currentTrack) return
    engine.loadStems(stems)
  }, [currentTrack?.id, stems])

  function scheduleSave(patch) {
    clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      api.patch(`/tracks/${currentTrack.id}`, patch)
        .then(() => qc.invalidateQueries({ queryKey: ['tracks', String(currentTrack.project_id)] }))
        .catch(() => {})
    }, 800)
  }

  // Reset loop UI state when track changes (loading is handled by outer Player)
  useEffect(() => {
    if (!currentTrack) return
    setLoopA(null)
    setLoopB(null)
    setLoopActive(false)
  }, [currentTrack?.id])

  // Media Session — lets OS keep audio alive when screen turns off
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.name,
      artist: currentTrack.project_name || '',
    })
    navigator.mediaSession.setActionHandler('play', () => engine.play())
    navigator.mediaSession.setActionHandler('pause', () => engine.pause())
    navigator.mediaSession.setActionHandler('previoustrack', () => playPrev())
    navigator.mediaSession.setActionHandler('nexttrack', () => playNext())
  }, [currentTrack?.id])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = engine.playing ? 'playing' : 'paused'
  }, [engine.playing])

  function togglePlay() {
    if (engine.playing) engine.pause()
    else engine.play()
  }

  function handleSeek(t) {
    if (t !== null && t !== undefined) engine.seek(t)
  }

  function handleScrubStart() {
    wasPlayingRef.current = engine.playing
    if (engine.playing) engine.pause()
  }

  function handleScrubEnd(t) {
    engine.seek(t)
    if (wasPlayingRef.current) engine.play()
  }

  function handleLoopAClick() {
    const t = engine.currentTime
    if (loopA !== null && Math.abs(loopA - t) < 0.5) {
      setLoopA(null); setLoopB(null); setLoopActive(false); engine.setLoopEnabled(false)
    } else {
      const newA = t
      const newB = loopB !== null ? Math.max(loopB, newA + 1) : engine.duration
      setLoopA(newA); setLoopB(newB); engine.setLoopPoints(newA, newB)
      if (loopB !== null) { engine.setLoopEnabled(true); setLoopActive(true) }
    }
  }

  function handleLoopBClick() {
    const t = engine.currentTime
    if (loopB !== null && Math.abs(loopB - t) < 0.5) {
      setLoopA(null); setLoopB(null); setLoopActive(false); engine.setLoopEnabled(false)
    } else {
      const newB = t
      const newA = loopA !== null ? Math.min(loopA, newB - 1) : 0
      setLoopA(newA); setLoopB(newB); engine.setLoopPoints(newA, newB)
      if (loopA !== null) { engine.setLoopEnabled(true); setLoopActive(true) }
    }
  }

  function toggleLoop() {
    const next = !loopActive
    setLoopActive(next)
    engine.setLoopEnabled(next)
    if (next) {
      if (loopA === null || loopB === null) {
        const a = 0, b = engine.duration
        setLoopA(a); setLoopB(b); engine.setLoopPoints(a, b)
      }
    } else {
      setLoopA(null); setLoopB(null)
    }
  }

  // Press-and-hold loop recording: down = set A, up = set B and activate
  function handleLoopPressDown(e) {
    e.preventDefault()
    loopPressARef.current = engine.currentTime
    setLoopPressing(true)
  }

  function handleLoopPressUp(e) {
    e.preventDefault()
    setLoopPressing(false)
    const a = loopPressARef.current
    loopPressARef.current = null
    if (a === null) return
    const b = engine.currentTime
    if (b - a > 0.3) {
      // Long press: commit region A→B and activate
      setLoopA(a); setLoopB(b)
      engine.setLoopPoints(a, b)
      engine.setLoopEnabled(true)
      setLoopActive(true)
    } else {
      // Quick tap: toggle loop on/off
      toggleLoop()
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true)
    try {
      const res = await api.post(`/tracks/${currentTrack.id}/analyze`)
      const { bpm: detectedBpm, key: detectedKey } = res.data
      setBpm(String(detectedBpm))
      setKey(detectedKey)
      await api.patch(`/tracks/${currentTrack.id}`, { bpm: detectedBpm, key_signature: detectedKey })
      qc.invalidateQueries({ queryKey: ['tracks', String(currentTrack.project_id)] })
    } catch (e) {
      console.error('Analyze failed:', e)
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSeparate() {
    setSeparating(true)
    try {
      await api.post(`/tracks/${currentTrack.id}/separate`)
    } catch (e) {
      setSeparating(false)
      console.error('Separation failed:', e)
    }
  }

  async function handleStemUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('name', file.name.replace(/\.[^.]+$/, ''))
    try {
      await api.post(`/tracks/${currentTrack.id}/stems`, fd)
      qc.invalidateQueries({ queryKey: ['stems', currentTrack.id] })
    } catch (e) {
      console.error('Stem upload failed:', e)
    }
    e.target.value = ''
  }

  async function handleStemVolumeChange(stem, volume) {
    setStemVolumes(prev => ({ ...prev, [stem.id]: volume }))
    engine.setStemVolume(stem.id, volume)
    try {
      await api.patch(`/stems/${stem.id}`, { volume })
    } catch {}
  }

  async function handleDeleteStem(stemId) {
    try {
      await api.delete(`/stems/${stemId}`)
      qc.invalidateQueries({ queryKey: ['stems', currentTrack.id] })
    } catch {}
  }

  const tabStyle = (name) => ({
    flex: 1, padding: '6px 0', border: 'none', cursor: 'pointer',
    background: 'transparent',
    borderBottom: `2px solid ${activeTab === name ? 'var(--accent)' : 'transparent'}`,
    color: activeTab === name ? 'var(--text-primary)' : 'var(--text-muted)',
    fontFamily: 'var(--font-ui)', fontSize: 'var(--text-xs)', fontWeight: 500,
    letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase',
    transition: `all var(--dur-hover) var(--ease)`,
  })

  const inputStyle = {
    width: '100%', background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
    padding: '7px 10px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)',
    outline: 'none', fontFamily: 'var(--font-ui)',
  }

  const inner = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top controls */}
      <div style={{ padding: '20px 20px 16px', flexShrink: 0 }}>
        {/* Cover placeholder */}
        {!isMobile && (
          <div style={{
            width: '100%', aspectRatio: '1', background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 14, flexShrink: 0, overflow: 'hidden',
          }}>
            <Music2 size={40} strokeWidth={1} style={{ color: 'var(--text-muted)' }} />
          </div>
        )}

        {/* Track info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 14 }}>
          <span className="mv-track-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentTrack.name}
          </span>
          <span className="mv-meta">
            {currentTrack.project_name || ''}
            {bpm ? ` · ${bpm} BPM` : ''}
            {key ? ` · ${key}` : ''}
          </span>
        </div>

        {/* Waveform */}
        <div style={{ height: 72, marginBottom: 6 }}>
          {engine.isLoading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 16, height: 16, border: '2px solid var(--border-strong)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : (
            <WaveCanvas
              peaks={engine.peaks}
              currentTime={engine.currentTime}
              duration={engine.duration}
              onSeek={handleSeek}
              onScrubStart={handleScrubStart}
              onScrubEnd={handleScrubEnd}
              loopA={loopA ?? 0}
              loopB={loopB ?? engine.duration}
              loopEnabled={loopActive}
            />
          )}
        </div>

        {/* Time row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="mv-mono" style={{ fontSize: 'var(--text-xs)' }}>{fmt(engine.currentTime)}</span>
          <span className="mv-mono" style={{ fontSize: 'var(--text-xs)' }}>{fmt(engine.duration)}</span>
        </div>

        {/* Transport */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
          <IconBtn onClick={playPrev} title="Previous"><SkipBack size={16} strokeWidth={1.5} /></IconBtn>
          <button onClick={togglePlay} style={{
            width: 44, height: 44, borderRadius: '50%', border: 'none',
            background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {engine.playing
              ? <Pause size={18} strokeWidth={1.5} />
              : <Play size={18} strokeWidth={1.5} style={{ marginLeft: 2 }} />}
          </button>
          <IconBtn onClick={playNext} title="Next"><SkipForward size={16} strokeWidth={1.5} /></IconBtn>
        </div>

        {/* Loop row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="mv-label">LOOP</span>
          <button onClick={handleLoopAClick} style={{
            padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid',
            borderColor: loopA !== null ? 'var(--border-strong)' : 'var(--border)',
            background: loopA !== null ? 'var(--accent-subtle)' : 'transparent',
            color: loopA !== null ? 'var(--text-primary)' : 'var(--text-muted)',
            fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', cursor: 'pointer',
          }}>A {loopA !== null ? fmt(loopA) : '--'}</button>
          <button onClick={handleLoopBClick} style={{
            padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid',
            borderColor: loopB !== null ? 'var(--border-strong)' : 'var(--border)',
            background: loopB !== null ? 'var(--accent-subtle)' : 'transparent',
            color: loopB !== null ? 'var(--text-primary)' : 'var(--text-muted)',
            fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', cursor: 'pointer',
          }}>B {loopB !== null ? fmt(loopB) : '--'}</button>
          {(loopA !== null || loopB !== null) && (
            <button onClick={toggleLoop} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 0, padding: 2 }}>
              <X size={12} strokeWidth={1.5} />
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button
            onPointerDown={handleLoopPressDown} onPointerUp={handleLoopPressUp}
            onPointerLeave={handleLoopPressUp}
            title="Hold to record A→B loop, tap to toggle"
            className={loopPressing ? 'mv-loop-recording' : undefined}
            style={{
              width: 28, height: 28, borderRadius: '50%', border: 'none',
              background: loopActive ? 'var(--accent-subtle)' : 'transparent',
              color: loopActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              touchAction: 'none',
            }}>
            <Repeat size={13} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border)', flexShrink: 0 }} />

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, padding: '0 20px' }}>
        <button style={tabStyle('edit')} onClick={() => setActiveTab('edit')}>Edit</button>
        <button style={tabStyle('lyrics')} onClick={() => setActiveTab('lyrics')}>Lyrics</button>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px' }}>
        {activeTab === 'edit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Pitch */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="mv-label">PITCH</span>
                <span className="mv-mono" style={{ fontSize: 'var(--text-xs)' }}>{engine.pitch > 0 ? '+' : ''}{engine.pitch}st</span>
              </div>
              <Slider value={engine.pitch} min={-12} max={12} step={1}
                onChange={(v) => engine.setPitch(Math.round(v))}
                onReset={() => engine.setPitch(0)} />
            </div>

            {/* Speed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="mv-label">SPEED</span>
                <span className="mv-mono" style={{ fontSize: 'var(--text-xs)' }}>{engine.speed.toFixed(2)}x</span>
              </div>
              <Slider value={engine.speed} min={0.5} max={2} step={0.05}
                onChange={engine.setSpeed}
                onReset={() => engine.setSpeed(1)} />
            </div>

            <div style={{ height: 1, background: 'var(--border)' }} />

            {/* BPM + Key with Analyze button */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="mv-label">BPM</span>
                <input type="number" min="1" max="999" placeholder="—" value={bpm}
                  onChange={e => { setBpm(e.target.value); const v = parseInt(e.target.value, 10); if (currentTrack) scheduleSave({ bpm: isNaN(v) ? null : v }) }}
                  style={inputStyle} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="mv-label">KEY</span>
                <input type="text" placeholder="C major…" value={key}
                  onChange={e => { setKey(e.target.value); if (currentTrack) scheduleSave({ key_signature: e.target.value || null }) }}
                  style={inputStyle} />
              </div>
              <button onClick={handleAnalyze} disabled={analyzing} title="Auto-detect BPM and Key" style={{
                height: 34, padding: '0 10px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)', cursor: analyzing ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginBottom: 1,
              }}>
                {analyzing
                  ? <Loader2 size={13} strokeWidth={1.5} style={{ animation: 'spin 0.8s linear infinite' }} />
                  : <Zap size={13} strokeWidth={1.5} />}
              </button>
            </div>

            <div style={{ height: 1, background: 'var(--border)' }} />

            {/* Stems */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="mv-label" style={{ flex: 1 }}>STEMS</span>
                <button
                  onClick={separating || stems.length > 0 ? undefined : handleSeparate}
                  disabled={separating || stems.length > 0}
                  title={stems.length > 0 ? 'Delete stems to regenerate' : 'Auto-separate stems with AI'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)', background: 'transparent',
                    color: stems.length > 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
                    fontSize: 'var(--text-xs)',
                    cursor: separating ? 'wait' : stems.length > 0 ? 'default' : 'pointer',
                    opacity: stems.length > 0 ? 0.5 : 1,
                  }}>
                  {separating
                    ? <Loader2 size={11} strokeWidth={2} style={{ animation: 'spin 0.8s linear infinite' }} />
                    : <Scissors size={11} strokeWidth={2} />}
                  {separating ? 'Separating…' : 'Auto'}
                </button>
                <button onClick={() => stemInputRef.current?.click()} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', cursor: 'pointer',
                }}>
                  <Plus size={11} strokeWidth={2} /> Manual
                </button>
                <input ref={stemInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleStemUpload} />
              </div>

              {separating && (
                <span className="mv-meta" style={{ fontSize: 'var(--text-xs)' }}>
                  AI separating vocals / drums / bass / other… this can take several minutes.
                </span>
              )}

              {!separating && stems.length === 0 && (
                <span className="mv-meta" style={{ fontSize: 'var(--text-xs)' }}>No stems. Use Auto to separate with AI, or Manual to upload.</span>
              )}

              {stems.map(stem => (
                <div key={stem.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ flex: 1, fontSize: 'var(--text-xs)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {stem.name}
                    </span>
                    <span className="mv-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', minWidth: 30, textAlign: 'right' }}>
                      {Math.round((stemVolumes[stem.id] ?? stem.volume) * 100)}%
                    </span>
                    <button onClick={() => handleDeleteStem(stem.id)} style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', lineHeight: 0, padding: 2, flexShrink: 0,
                    }}>
                      <Trash2 size={11} strokeWidth={1.5} />
                    </button>
                  </div>
                  <Slider
                    value={stemVolumes[stem.id] ?? stem.volume} min={0} max={1} step={0.01}
                    onChange={(v) => handleStemVolumeChange(stem, Math.round(v * 100) / 100)}
                    onReset={() => handleStemVolumeChange(stem, 1)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'lyrics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
            <span className="mv-label">LYRICS</span>
            <textarea placeholder="Paste or write lyrics here…" value={lyrics}
              onChange={e => { setLyrics(e.target.value); if (currentTrack) scheduleSave({ lyrics: e.target.value || null }) }}
              style={{ ...inputStyle, flex: 1, minHeight: 200, resize: 'vertical', lineHeight: 1.6, padding: '10px 12px' }}
            />
            <span className="mv-meta" style={{ fontSize: 'var(--text-xs)' }}>Auto-saved as you type</span>
          </div>
        )}
      </div>
    </div>
  )

  // ── Mobile full-screen player ───────────────────────────────────────────────
  if (isMobile) {
    const cover = currentTrack.project_cover_image

    const squareBtn = (onClick, children, extraStyle = {}) => (
      <button onClick={onClick} style={{
        width: 52, height: 52, borderRadius: 14, border: 'none',
        background: 'var(--bg-secondary)', color: 'var(--text-primary)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        ...extraStyle,
      }}>{children}</button>
    )

    // ── Edit full-screen view ──────────────────────────────────────────────
    if (mobileTab === 'edit') {
      const subTabBtn = (name, label) => (
        <button onClick={() => setEditSubTab(name)} style={{
          flex: 1, padding: '12px 0', border: 'none', cursor: 'pointer',
          background: 'transparent',
          color: editSubTab === name ? 'var(--text-primary)' : 'var(--text-muted)',
          fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: editSubTab === name ? 700 : 400,
          borderBottom: `2px solid ${editSubTab === name ? 'var(--text-primary)' : 'transparent'}`,
        }}>{label}</button>
      )

      return (
        <div className="mv-sheet" style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header: Cancel / title / Save */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 6px', flexShrink: 0 }}>
            <button onClick={() => setMobileTab(null)} style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: 20, padding: '7px 16px', color: 'var(--text-primary)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={() => setMobileTab(null)} style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: 20, padding: '7px 16px', color: 'var(--text-muted)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
              Save
            </button>
          </div>

          {/* Track title + project */}
          <div style={{ textAlign: 'center', padding: '6px 20px 4px', flexShrink: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentTrack.name}</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 2 }}>{currentTrack.project_name || ''}</div>
          </div>

          {/* Key / BPM chips + Analyze */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '6px 20px 8px', flexShrink: 0, flexWrap: 'wrap' }}>
            {key ? (
              <span style={{ background: 'var(--bg-secondary)', borderRadius: 20, padding: '6px 14px', fontSize: 14, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{key}</span>
            ) : null}
            {bpm ? (
              <span style={{ background: 'var(--bg-secondary)', borderRadius: 20, padding: '6px 14px', fontSize: 14, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{bpm} BPM</span>
            ) : null}
            <button onClick={handleAnalyze} disabled={analyzing} style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 14, color: 'var(--text-muted)', cursor: analyzing ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              {analyzing ? <Loader2 size={13} strokeWidth={2} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Zap size={13} strokeWidth={1.5} />}
              Analyze
            </button>
          </div>

          {/* Waveform — tall */}
          <div style={{ height: 160, flexShrink: 0 }}>
            {engine.isLoading
              ? <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 18, height: 18, border: '2px solid var(--border-strong)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>
              : <WaveCanvas peaks={engine.peaks} currentTime={engine.currentTime} duration={engine.duration} onSeek={handleSeek} onScrubStart={handleScrubStart} onScrubEnd={handleScrubEnd} loopA={loopA ?? 0} loopB={loopB ?? engine.duration} loopEnabled={loopActive} />}
          </div>

          {/* Time */}
          <div style={{ textAlign: 'center', padding: '6px 0 4px', flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--text-secondary)' }}>
              {fmt(engine.currentTime)} / {fmt(engine.duration)}
            </span>
          </div>

          {/* Transport: SkipBack | Loop (hold=record, tap=toggle) | Play/Pause */}
          <div style={{ display: 'flex', gap: 10, padding: '4px 20px 12px', flexShrink: 0 }}>
            {squareBtn(playPrev, <SkipBack size={22} strokeWidth={1.5} />)}
            <button
              onPointerDown={handleLoopPressDown} onPointerUp={handleLoopPressUp}
              onPointerLeave={handleLoopPressUp}
              className={loopPressing ? 'mv-loop-recording' : undefined}
              style={{
                flex: 1, height: 52, borderRadius: 14, border: 'none',
                background: loopActive ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                color: loopActive ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15, fontWeight: 500,
                touchAction: 'none', userSelect: 'none',
              }}>
              <Repeat size={18} strokeWidth={1.5} />
              {loopActive
                ? (loopA !== null && loopB !== null ? `${fmt(loopA)} → ${fmt(loopB)}` : 'Looping')
                : 'Loop'}
            </button>
            {squareBtn(togglePlay, engine.playing ? <Pause size={22} strokeWidth={1.5} /> : <Play size={22} strokeWidth={1.5} style={{ marginLeft: 2 }} />)}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border)', flexShrink: 0 }} />

          {/* Sub-content: Adjust or Stems */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 0' }}>
            {editSubTab === 'adjust' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 2 }}>VARISPEED</span>
                <EditSlider
                  label="Speed" value={engine.speed} min={0.5} max={2}
                  display={`${Math.round(engine.speed * 100)}%`}
                  onChange={engine.setSpeed} onReset={() => engine.setSpeed(1)}
                />
                <EditSlider
                  label="Pitch" value={engine.pitch} min={-12} max={12}
                  display={`${engine.pitch > 0 ? '+' : ''}${engine.pitch} st`}
                  onChange={v => engine.setPitch(Math.round(v))} onReset={() => engine.setPitch(0)}
                />
                <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
                {/* BPM + Key inline inputs */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', fontWeight: 600 }}>BPM</span>
                    <input type="number" min="1" max="999" placeholder="—" value={bpm}
                      onChange={e => { setBpm(e.target.value); const v = parseInt(e.target.value, 10); scheduleSave({ bpm: isNaN(v) ? null : v }) }}
                      style={{ width: '100%', background: 'var(--bg-secondary)', border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 15, color: 'var(--text-primary)', outline: 'none' }} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', fontWeight: 600 }}>KEY</span>
                    <input type="text" placeholder="C major…" value={key}
                      onChange={e => { setKey(e.target.value); scheduleSave({ key_signature: e.target.value || null }) }}
                      style={{ width: '100%', background: 'var(--bg-secondary)', border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 15, color: 'var(--text-primary)', outline: 'none' }} />
                  </div>
                </div>
              </div>
            )}

            {editSubTab === 'stems' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Stems</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Split your track into stems</div>
                  </div>
                  <button
                    onClick={separating || stems.length > 0 ? undefined : handleSeparate}
                    disabled={separating || stems.length > 0}
                    title={stems.length > 0 ? 'Delete stems to regenerate' : undefined}
                    style={{ background: stems.length > 0 ? 'var(--bg-tertiary)' : '#fff', border: 'none', borderRadius: 20, padding: '10px 20px', fontSize: 15, fontWeight: 600, color: stems.length > 0 ? 'var(--text-muted)' : '#000', cursor: separating ? 'wait' : stems.length > 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, opacity: stems.length > 0 ? 0.5 : 1 }}>
                    {separating ? <Loader2 size={14} strokeWidth={2} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
                    {separating ? 'Generating…' : 'Generate'}
                  </button>
                </div>
                <input ref={stemInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleStemUpload} />

                {/* Fader grid */}
                <div style={{ display: 'flex', gap: 10, flex: 1, minHeight: 0 }}>
                  {stems.length === 0 ? (
                    /* Placeholder cards when no stems */
                    ['vocals', 'drums', 'bass', 'other'].map(name => (
                      <div key={name} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'var(--bg-secondary)', borderRadius: 16, padding: '16px 8px 12px', minHeight: 180 }}>
                        <div style={{ flex: 1, width: '100%', position: 'relative' }}>
                          {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} style={{ position: 'absolute', left: 8, right: 8, top: `${(i / 11) * 100}%`, height: 1.5, borderRadius: 1, background: 'rgba(255,255,255,0.18)' }} />
                          ))}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.03em' }}>{name}</div>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
                      </div>
                    ))
                  ) : (
                    stems.map(stem => (
                      <div key={stem.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'var(--bg-secondary)', borderRadius: 16, padding: '16px 8px 12px', minHeight: 180 }}>
                        <VerticalFader
                          value={stemVolumes[stem.id] ?? stem.volume}
                          onChange={v => handleStemVolumeChange(stem, Math.round(v * 100) / 100)}
                          onReset={() => handleStemVolumeChange(stem, 1)}
                        />
                        <div style={{ fontSize: 12, color: 'var(--text-primary)', letterSpacing: '0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{stem.name}</div>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: (stemVolumes[stem.id] ?? stem.volume) > 0 ? 'var(--accent)' : 'rgba(255,255,255,0.2)' }} />
                      </div>
                    ))
                  )}
                </div>

                {separating && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                    AI separating vocals / drums / bass / other… may take a few minutes.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom sub-tab bar: Adjust | Stems */}
          <div style={{ display: 'flex', borderTop: '1px solid var(--border)', flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
            {subTabBtn('adjust', 'Adjust')}
            {subTabBtn('stems', 'Stems')}
          </div>
        </div>
      )
    }

    // ── Normal player (cover + transport) ─────────────────────────────────
    const tabBtnStyle = (active) => ({
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      background: 'transparent', border: 'none', cursor: 'pointer',
      color: active ? 'var(--text-primary)' : 'var(--text-muted)',
      padding: '8px 24px',
    })

    return (
      <div className="mv-sheet" style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px 8px', flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', lineHeight: 0, padding: 4 }}>
            <ChevronDown size={24} strokeWidth={1.5} />
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentTrack.name}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              {currentTrack.project_name || ''}
            </div>
          </div>
          <div style={{ width: 32 }} />
        </div>

        {/* Cover art / notes */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px' }}>
          {mobileTab === null && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{
                width: '75vw', height: '75vw', maxWidth: 320, maxHeight: 320,
                borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-elevated)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
              }}>
                {cover
                  ? <img src={cover} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Music2 size={64} strokeWidth={1} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>
          )}
          {mobileTab === 'notes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
              <textarea
                placeholder="Letras / notas…"
                value={lyrics}
                onChange={e => { setLyrics(e.target.value); if (currentTrack) scheduleSave({ lyrics: e.target.value || null }) }}
                style={{ flex: 1, minHeight: 160, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', fontSize: 15, color: 'var(--text-primary)', outline: 'none', resize: 'none', lineHeight: 1.6, fontFamily: 'var(--font-ui)' }}
              />
            </div>
          )}
        </div>

        {/* Waveform strip */}
        <div style={{ height: 56, padding: '0 20px', flexShrink: 0 }}>
          {engine.isLoading
            ? <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 16, height: 16, border: '2px solid var(--border-strong)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>
            : <WaveCanvas peaks={engine.peaks} currentTime={engine.currentTime} duration={engine.duration} onSeek={handleSeek} onScrubStart={handleScrubStart} onScrubEnd={handleScrubEnd} loopA={loopA ?? 0} loopB={loopB ?? engine.duration} loopEnabled={loopActive} />}
        </div>

        {/* Time */}
        <div style={{ textAlign: 'center', padding: '6px 0', flexShrink: 0 }}>
          <span className="mv-mono" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            {fmt(engine.currentTime)} / {fmt(engine.duration)}
          </span>
        </div>

        {/* Transport: SkipBack | Play big | SkipForward */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, padding: '8px 20px', flexShrink: 0 }}>
          <IconBtn onClick={playPrev} size={44}><SkipBack size={22} strokeWidth={1.5} /></IconBtn>
          <button onClick={togglePlay} style={{
            width: 64, height: 64, borderRadius: '50%', border: 'none',
            background: 'var(--text-primary)', color: 'var(--bg-primary)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {engine.playing ? <Pause size={26} strokeWidth={1.5} /> : <Play size={26} strokeWidth={1.5} style={{ marginLeft: 3 }} />}
          </button>
          <IconBtn onClick={playNext} size={44}><SkipForward size={22} strokeWidth={1.5} /></IconBtn>
        </div>

        {/* Bottom tab bar: Notes | Edit */}
        <div style={{ display: 'flex', justifyContent: 'space-around', borderTop: '1px solid var(--border)', flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
          <button style={tabBtnStyle(mobileTab === 'notes')} onClick={() => setMobileTab(prev => prev === 'notes' ? null : 'notes')}>
            <FileText size={22} strokeWidth={1.5} />
            <span style={{ fontSize: 11, letterSpacing: '0.05em' }}>notes</span>
          </button>
          <button style={tabBtnStyle(mobileTab === 'edit')} onClick={() => setMobileTab('edit')}>
            <SlidersHorizontal size={22} strokeWidth={1.5} />
            <span style={{ fontSize: 11, letterSpacing: '0.05em' }}>edit</span>
          </button>
        </div>
      </div>
    )
  }

  return inner
}

export default function Player({ isMobile = false }) {
  const { currentTrack, playNext, playPrev, setPlaying } = usePlayer()
  const engine = useAudioEngine()
  const [expanded, setExpanded] = useState(false)

  // Load and auto-play whenever the selected track changes — runs regardless
  // of whether the full player is expanded (fixes mobile mini-bar not playing)
  useEffect(() => {
    if (!currentTrack) return
    if (engine.loadedTrackId === currentTrack.id) return
    engine.loadTrack(currentTrack.id).then(() => engine.play(0))
  }, [currentTrack?.id])

  // Keep PlayerContext in sync so TrackList can show the equalizer only when actually playing
  useEffect(() => {
    setPlaying(engine.playing)
  }, [engine.playing])

  function togglePlay() {
    if (engine.playing) engine.pause()
    else engine.play()
  }

  // Mobile mini-bar
  if (isMobile) {
    if (!currentTrack) return null
    if (expanded) {
      return (
        <PlayerContent
          engine={engine} currentTrack={currentTrack}
          playNext={playNext} playPrev={playPrev}
          onClose={() => setExpanded(false)} isMobile
        />
      )
    }
    return (
      <div
        onClick={() => setExpanded(true)}
        className="mv-bar-in"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          height: 64, background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
          cursor: 'pointer',
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 'var(--radius-md)',
          background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Music2 size={18} strokeWidth={1} style={{ color: 'var(--text-muted)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentTrack.name}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {currentTrack.project_name || ''}
          </div>
        </div>
        <IconBtn onClick={(e) => { e.stopPropagation(); playPrev() }}><SkipBack size={18} strokeWidth={1.5} /></IconBtn>
        <button onClick={(e) => { e.stopPropagation(); togglePlay() }} style={{
          width: 40, height: 40, borderRadius: '50%', border: 'none',
          background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {engine.playing
            ? <Pause size={18} strokeWidth={1.5} />
            : <Play size={18} strokeWidth={1.5} style={{ marginLeft: 2 }} />}
        </button>
        <IconBtn onClick={(e) => { e.stopPropagation(); playNext() }}><SkipForward size={18} strokeWidth={1.5} /></IconBtn>
      </div>
    )
  }

  // Desktop sidebar
  return (
    <aside className="mv-player" style={{
      width: 'var(--col-player)', flexShrink: 0, background: 'var(--bg-secondary)',
      borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {!currentTrack ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Disc3 size={32} strokeWidth={1} style={{ color: 'var(--text-muted)' }} />
          <span className="mv-meta" style={{ color: 'var(--text-muted)' }}>Nothing playing.</span>
        </div>
      ) : (
        <PlayerContent
          engine={engine} currentTrack={currentTrack}
          playNext={playNext} playPrev={playPrev}
          onClose={() => {}} isMobile={false}
        />
      )}
    </aside>
  )
}
