import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Play, Pause, SkipBack, SkipForward, Volume2,
  Repeat, Shuffle, Music2, Disc3,
} from 'lucide-react'
import { usePlayer } from '../../hooks/usePlayer'
import { useAudioEngine } from '../../hooks/useAudioEngine'
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

  const getValueFromEvent = useCallback((e) => {
    const rect = trackRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    return min + ratio * (max - min)
  }, [min, max])

  const handleMouseDown = useCallback((e) => {
    e.preventDefault()
    dragging.current = true
    onChange(getValueFromEvent(e))

    const onMove = (ev) => {
      if (dragging.current) onChange(getValueFromEvent(ev))
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [getValueFromEvent, onChange])

  return (
    <div
      ref={trackRef}
      onDoubleClick={onReset}
      onMouseDown={handleMouseDown}
      style={{ position: 'relative', height: 14, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
    >
      <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'var(--waveform-inactive)', borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 2, background: 'var(--accent)', borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: `${pct}%`, width: 10, height: 10, marginLeft: -5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
    </div>
  )
}

function IconBtn({ onClick, children, active, size = 32, title }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: size, height: size, borderRadius: '50%', border: 'none',
        background: active ? 'var(--accent-subtle)' : hover ? 'var(--bg-tertiary)' : 'transparent',
        color: active ? 'var(--text-primary)' : hover ? 'var(--text-primary)' : 'var(--text-secondary)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: `all var(--dur-hover) var(--ease)`, flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

export default function Player() {
  const { currentTrack, playNext, playPrev } = usePlayer()
  const engine = useAudioEngine()
  const [volume, setVolume] = useState(0.8)
  const [clickMode, setClickMode] = useState('seek')
  const [loopActive, setLoopActive] = useState(false)
  const [loopA, setLoopA] = useState(null)
  const [loopB, setLoopB] = useState(null)

  // Load track when it changes
  useEffect(() => {
    if (!currentTrack) return
    engine.loadTrack(currentTrack.id).then(() => {
      engine.play(0)
    })
  }, [currentTrack?.id])

  // Volume
  useEffect(() => {
    try {
      const { Tone } = window
      if (Tone) Tone.getDestination().volume.value = 20 * Math.log10(Math.max(0.0001, volume))
    } catch {}
  }, [volume])

  function togglePlay() {
    if (engine.playing) engine.pause()
    else engine.play()
  }

  function handleSeek(t, newA, newB) {
    if (t !== null && t !== undefined) engine.seek(t)
    if (newA !== undefined && newB !== undefined) engine.setLoopPoints(newA, newB)
  }

  function handleLoopAClick() {
    const t = engine.currentTime
    if (loopA !== null && Math.abs(loopA - t) < 0.1) {
      setLoopA(null)
      if (loopActive) { engine.setLoopEnabled(false); setLoopActive(false) }
    } else {
      const newA = t
      const newB = loopB !== null ? Math.max(loopB, newA + 0.5) : engine.duration
      setLoopA(newA)
      setLoopB(newB)
      engine.setLoopPoints(newA, newB)
      if (loopB !== null) { engine.setLoopEnabled(true); setLoopActive(true) }
    }
  }

  function handleLoopBClick() {
    const t = engine.currentTime
    if (loopB !== null && Math.abs(loopB - t) < 0.1) {
      setLoopB(null)
      if (loopActive) { engine.setLoopEnabled(false); setLoopActive(false) }
    } else {
      const newB = t
      const newA = loopA !== null ? Math.min(loopA, newB - 0.5) : 0
      setLoopA(newA)
      setLoopB(newB)
      engine.setLoopPoints(newA, newB)
      if (loopA !== null) { engine.setLoopEnabled(true); setLoopActive(true) }
    }
  }

  function toggleLoop() {
    const next = !loopActive
    setLoopActive(next)
    engine.setLoopEnabled(next)
    if (next && (loopA === null || loopB === null)) {
      const a = 0, b = engine.duration
      setLoopA(a); setLoopB(b)
      engine.setLoopPoints(a, b)
    }
  }

  return (
    <aside style={{
      width: 'var(--col-player)', flexShrink: 0, background: 'var(--bg-secondary)',
      borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {!currentTrack ? (
        /* Empty state */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Disc3 size={32} strokeWidth={1} style={{ color: 'var(--text-muted)' }} />
          <span className="mv-meta" style={{ color: 'var(--text-muted)' }}>Nothing playing.</span>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 20px 20px', gap: 16, overflowY: 'auto' }}>
          {/* Cover art placeholder */}
          <div style={{
            width: '100%', aspectRatio: '1', background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Music2 size={40} strokeWidth={1} style={{ color: 'var(--text-muted)' }} />
          </div>

          {/* Track info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="mv-track-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentTrack.name}
            </span>
            <span className="mv-meta">
              {currentTrack.artist || 'Unknown artist'}
              {currentTrack.project_name ? ` · ${currentTrack.project_name}` : ''}
            </span>
          </div>

          {/* Waveform */}
          <div style={{ height: 80, flexShrink: 0 }}>
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
                clickMode={clickMode}
                onClickDone={() => setClickMode('seek')}
              />
            )}
          </div>

          {/* Time row */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="mv-mono" style={{ fontSize: 'var(--text-xs)' }}>{fmt(engine.currentTime)}</span>
            <span className="mv-mono" style={{ fontSize: 'var(--text-xs)' }}>{fmt(engine.duration)}</span>
          </div>

          {/* Transport */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <IconBtn onClick={playPrev} title="Previous">
              <SkipBack size={16} strokeWidth={1.5} />
            </IconBtn>
            <button
              onClick={togglePlay}
              style={{
                width: 44, height: 44, borderRadius: '50%', border: 'none',
                background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: `background var(--dur-hover) var(--ease)`,
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#2a2a2a'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
            >
              {engine.playing
                ? <Pause size={18} strokeWidth={1.5} />
                : <Play size={18} strokeWidth={1.5} style={{ marginLeft: 2 }} />}
            </button>
            <IconBtn onClick={playNext} title="Next">
              <SkipForward size={16} strokeWidth={1.5} />
            </IconBtn>
          </div>

          {/* Loop row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="mv-label" style={{ flexShrink: 0 }}>LOOP</span>
            <button
              onClick={handleLoopAClick}
              style={{
                padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid',
                borderColor: loopA !== null ? 'var(--border-strong)' : 'var(--border)',
                background: loopA !== null ? 'var(--accent-subtle)' : 'transparent',
                color: loopA !== null ? 'var(--text-primary)' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', cursor: 'pointer',
                transition: `all var(--dur-hover) var(--ease)`,
              }}
            >
              A {loopA !== null ? fmt(loopA) : '--'}
            </button>
            <button
              onClick={handleLoopBClick}
              style={{
                padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid',
                borderColor: loopB !== null ? 'var(--border-strong)' : 'var(--border)',
                background: loopB !== null ? 'var(--accent-subtle)' : 'transparent',
                color: loopB !== null ? 'var(--text-primary)' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', cursor: 'pointer',
                transition: `all var(--dur-hover) var(--ease)`,
              }}
            >
              B {loopB !== null ? fmt(loopB) : '--'}
            </button>
            <div style={{ flex: 1 }} />
            <IconBtn onClick={toggleLoop} active={loopActive} size={28} title="Loop">
              <Repeat size={13} strokeWidth={1.5} />
            </IconBtn>
            <IconBtn size={28} title="Shuffle">
              <Shuffle size={13} strokeWidth={1.5} />
            </IconBtn>
          </div>

          {/* Volume */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Volume2 size={14} strokeWidth={1.5} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <Slider
                value={volume}
                min={0} max={1} step={0.01}
                onChange={setVolume}
                onReset={() => setVolume(0.8)}
              />
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border)', flexShrink: 0 }} />

          {/* Pitch */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="mv-label">PITCH</span>
              <span className="mv-mono" style={{ fontSize: 'var(--text-xs)' }}>
                {engine.pitch > 0 ? '+' : ''}{engine.pitch}st
              </span>
            </div>
            <Slider
              value={engine.pitch}
              min={-12} max={12} step={1}
              onChange={(v) => engine.setPitch(Math.round(v))}
              onReset={() => engine.setPitch(0)}
            />
          </div>

          {/* Speed */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="mv-label">SPEED</span>
              <span className="mv-mono" style={{ fontSize: 'var(--text-xs)' }}>
                {engine.speed.toFixed(2)}x
              </span>
            </div>
            <Slider
              value={engine.speed}
              min={0.5} max={2} step={0.05}
              onChange={engine.setSpeed}
              onReset={() => engine.setSpeed(1)}
            />
          </div>
        </div>
      )}
    </aside>
  )
}
