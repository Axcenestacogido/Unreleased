import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Play, Pause, SkipBack, SkipForward,
  Repeat, Disc3, Music2, X, ChevronDown,
  Plus, Trash2, Loader2, Zap, Scissors,
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
  const dragging = useRef(false)
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))

  const getVal = useCallback((e) => {
    const rect = trackRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    return min + ratio * (max - min)
  }, [min, max])

  const handleDown = useCallback((e) => {
    e.preventDefault()
    dragging.current = true
    onChange(getVal(e))
    const onMove = (ev) => { if (dragging.current) onChange(getVal(ev)) }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [getVal, onChange])

  return (
    <div ref={trackRef} onDoubleClick={onReset} onMouseDown={handleDown}
      style={{ position: 'relative', height: 14, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'var(--waveform-inactive)', borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 2, background: 'var(--accent)', borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: `${pct}%`, width: 10, height: 10, marginLeft: -5, borderRadius: '50%', background: 'var(--accent)' }} />
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

function PlayerContent({ engine, currentTrack, playNext, playPrev, onClose, isMobile }) {
  const qc = useQueryClient()

  const [activeTab, setActiveTab] = useState('edit')
  const [loopActive, setLoopActive] = useState(false)
  const [loopA, setLoopA] = useState(null)
  const [loopB, setLoopB] = useState(null)

  const [bpm, setBpm] = useState('')
  const [key, setKey] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [separating, setSeparating] = useState(false)
  const saveTimeout = useRef(null)
  const stemInputRef = useRef(null)

  // Fetch stems via query so SSE invalidation triggers a refresh
  const { data: stems = [] } = useQuery({
    queryKey: ['stems', currentTrack?.id],
    queryFn: () => api.get(`/tracks/${currentTrack.id}/stems`).then(r => r.data),
    enabled: !!currentTrack,
    onSuccess: (data) => {
      if (data.length > 0 && separating) setSeparating(false)
    },
  })

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

  useEffect(() => {
    if (!currentTrack) return
    setLoopA(null)
    setLoopB(null)
    setLoopActive(false)
    engine.loadTrack(currentTrack.id).then(() => {
      engine.play(0)
    })
  }, [currentTrack?.id])

  function togglePlay() {
    if (engine.playing) engine.pause()
    else engine.play()
  }

  function handleSeek(t) {
    if (t !== null && t !== undefined) engine.seek(t)
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
              loopA={loopA ?? 0}
              loopB={loopB ?? engine.duration}
              loopEnabled={loopActive}
              clickMode="seek"
              onClickDone={() => {}}
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
          <IconBtn onClick={toggleLoop} active={loopActive} size={28} title="Loop">
            <Repeat size={13} strokeWidth={1.5} />
          </IconBtn>
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
                  onChange={e => { setBpm(e.target.value); if (currentTrack) scheduleSave({ bpm: e.target.value ? parseInt(e.target.value) : null }) }}
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
                <button onClick={handleSeparate} disabled={separating} title="Auto-separate stems with AI" style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text-secondary)', fontSize: 'var(--text-xs)',
                  cursor: separating ? 'wait' : 'pointer',
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
                      {Math.round(stem.volume * 100)}%
                    </span>
                    <button onClick={() => handleDeleteStem(stem.id)} style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', lineHeight: 0, padding: 2, flexShrink: 0,
                    }}>
                      <Trash2 size={11} strokeWidth={1.5} />
                    </button>
                  </div>
                  <Slider
                    value={stem.volume} min={0} max={1} step={0.01}
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

  // Mobile: full-screen overlay
  if (isMobile) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Mobile header */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '12px 16px',
          borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', lineHeight: 0, padding: 4, marginRight: 8,
          }}>
            <ChevronDown size={22} strokeWidth={1.5} />
          </button>
          <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentTrack?.name}
          </span>
        </div>
        {inner}
      </div>
    )
  }

  return inner
}

export default function Player({ isMobile = false }) {
  const { currentTrack, playNext, playPrev } = usePlayer()
  const engine = useAudioEngine()
  const [expanded, setExpanded] = useState(false)

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
