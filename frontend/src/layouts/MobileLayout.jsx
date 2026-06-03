import { useState, useEffect, useRef, useCallback } from 'react'
import { Outlet, useNavigate, useMatch } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Play, Pause, SkipBack, SkipForward, ChevronDown,
  Music2, House, Disc3, Search, Upload, Repeat, Shuffle, Volume2,
  Share2, ChevronRight, Pencil, Camera, Check, X, ArrowDownToLine,
} from 'lucide-react'
import { usePlayer } from '../hooks/usePlayer'
import { useAudioEngine } from '../hooks/useAudioEngine'
import { useSSEStatus } from '../hooks/useSSE'
import api from '../api/client'
import WaveCanvas from '../components/Player/WaveCanvas'
import TrackList from '../components/TrackList/TrackList'
import ShareModal from '../components/ShareModal/ShareModal'

function fmt(s) {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const TAP = {
  width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0,
  WebkitTapHighlightColor: 'transparent',
}

/* ── Touch-friendly slider ───────────────────────────────────────────────── */
function Slider({ value, min, max, step, onChange, onReset }) {
  const ref = useRef(null)
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  const drag = useCallback((clientX) => {
    const r = ref.current.getBoundingClientRect()
    let p = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    let v = min + p * (max - min)
    v = Math.round(v / step) * step
    onChange(v)
  }, [min, max, step, onChange])
  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    drag(e.clientX)
    const move = (ev) => drag(ev.clientX)
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }, [drag])
  const onTouchStart = useCallback((e) => {
    e.preventDefault()
    drag(e.touches[0].clientX)
    const move = (ev) => { ev.preventDefault(); drag(ev.touches[0].clientX) }
    const end = () => { window.removeEventListener('touchmove', move); window.removeEventListener('touchend', end) }
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', end)
  }, [drag])
  return (
    <div ref={ref} onMouseDown={onMouseDown} onTouchStart={onTouchStart} onDoubleClick={onReset}
      style={{ position: 'relative', height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', touchAction: 'none' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'var(--waveform-inactive)', borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 2, background: 'var(--accent)', borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: `${pct}%`, width: 14, height: 14, marginLeft: -7, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 0 3px rgba(255,255,255,0.1)' }} />
    </div>
  )
}

/* ── Metadata edit sheet ────────────────────────────────────────────────── */
function MetadataSheet({ track, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: track?.name || '',
    artist: track?.artist || '',
    album: track?.album || '',
    year: track?.year ? String(track.year) : '',
    genre: track?.genre || '',
  })
  const save = useMutation({
    mutationFn: () => api.patch(`/tracks/${track.id}`, {
      name: form.name || undefined,
      artist: form.artist || undefined,
      album: form.album || undefined,
      year: form.year ? parseInt(form.year) : undefined,
      genre: form.genre || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tracks'] })
      onClose()
    },
  })
  const field = (label, key, opts = {}) => (
    <div style={{ marginBottom: 16 }}>
      <div className="mv-label" style={{ marginBottom: 6 }}>{label}</div>
      <input
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={opts.placeholder || ''}
        inputMode={opts.inputMode}
        style={{
          width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-md)', padding: '10px 12px', color: 'var(--text-primary)',
          fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', outline: 'none',
          WebkitAppearance: 'none',
        }}
      />
    </div>
  )
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', animation: 'mvSlideUp 180ms var(--ease)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div style={{ flexShrink: 0, height: 56, display: 'flex', alignItems: 'center', padding: '0 8px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={onClose} style={TAP}><X size={22} style={{ color: 'var(--text-secondary)' }} /></button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span className="mv-label">Edit track info</span>
        </div>
        <button onClick={() => save.mutate()} disabled={save.isPending} style={{ ...TAP, color: save.isPending ? 'var(--text-muted)' : 'var(--text-primary)' }}>
          <Check size={22} />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
        {field('Title', 'name')}
        {field('Artist', 'artist')}
        {field('Album', 'album')}
        {field('Year', 'year', { inputMode: 'numeric', placeholder: 'e.g. 2024' })}
        {field('Genre', 'genre')}
      </div>
    </div>
  )
}

/* ── Bottom nav ─────────────────────────────────────────────────────────── */
function BottomNav({ tab, setTab }) {
  const items = [
    { id: 'library', Icon: House, label: 'Library' },
    { id: 'projects', Icon: Disc3, label: 'Projects' },
    { id: 'search', Icon: Search, label: 'Search' },
    { id: 'upload', Icon: Upload, label: 'Upload' },
  ]
  return (
    <nav style={{ flexShrink: 0, display: 'flex', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {items.map(({ id, Icon: Ic, label }) => {
        const active = tab === id
        return (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, height: 60, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 4, background: 'transparent', border: 'none',
            cursor: 'pointer', color: active ? 'var(--text-primary)' : 'var(--text-muted)',
            WebkitTapHighlightColor: 'transparent',
            transition: 'color var(--dur-hover) var(--ease)',
          }}>
            <Ic size={20} strokeWidth={active ? 2 : 1.5} />
            <span style={{ fontSize: 10, letterSpacing: '0.02em', fontWeight: active ? 500 : 400 }}>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}

/* ── Mini player ────────────────────────────────────────────────────────── */
function MiniPlayer({ track, engine, onExpand, onSkipNext }) {
  if (!track) return null
  const progress = engine.duration > 0 ? engine.currentTime / engine.duration : 0
  return (
    <div onClick={onExpand} style={{
      flexShrink: 0, height: 64, background: 'var(--bg-tertiary)',
      borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center',
      gap: 12, padding: '0 8px 0 14px', cursor: 'pointer', position: 'relative',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--waveform-inactive)' }}>
        <div style={{ height: '100%', width: `${progress * 100}%`, background: 'var(--accent)' }} />
      </div>
      <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', flexShrink: 0, background: 'var(--bg-elevated)', overflow: 'hidden', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {track.project_cover_url
          ? <img src={track.project_cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Music2 size={18} strokeWidth={1} style={{ color: 'var(--text-muted)' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mv-ui" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.name}</div>
        <div className="mv-meta" style={{ fontSize: 'var(--text-xs)' }}>{track.artist || 'Unknown artist'}</div>
      </div>
      <button onClick={(e) => { e.stopPropagation(); engine.playing ? engine.pause() : engine.play() }} style={TAP}>
        {engine.playing
          ? <Pause size={22} strokeWidth={2} style={{ color: 'var(--text-primary)' }} />
          : <Play size={22} strokeWidth={2} style={{ color: 'var(--text-primary)', marginLeft: 2 }} />}
      </button>
      <button onClick={(e) => { e.stopPropagation(); onSkipNext() }} style={TAP}>
        <SkipForward size={20} strokeWidth={1.75} style={{ color: 'var(--text-secondary)' }} />
      </button>
    </div>
  )
}

/* ── Fullscreen player ───────────────────────────────────────────────────── */
function FullScreenPlayer({ track, engine, onClose, onShare, onEditMeta, repeatMode, onToggleRepeat, shuffle, onToggleShuffle, onSkipNext, onSkipPrev }) {
  const qc = useQueryClient()
  const [loopA, setLoopAState] = useState(null) // seconds or null
  const [loopB, setLoopBState] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const scrubRef = useRef({ wasPlaying: false })
  const coverInputRef = useRef(null)

  function handleScrubStart() {
    scrubRef.current.wasPlaying = engine.playing
    if (engine.playing) engine.pause()
  }

  function handleScrubEnd(t) {
    engine.seek(t)
    if (scrubRef.current.wasPlaying) engine.play()
  }

  async function handleDownload() {
    if (!track || downloading || engine.isCached) return
    setDownloading(true)
    await engine.downloadTrack(track.id)
    setDownloading(false)
  }

  const uploadCover = useMutation({
    mutationFn: (file) => {
      const fd = new FormData()
      fd.append('file', file)
      return api.post(`/projects/${track.project_id}/cover`, fd)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tracks'] }),
  })

  const loopBtn = (active) => ({
    width: 40, height: 36, borderRadius: 'var(--radius-sm)', cursor: 'pointer',
    fontFamily: 'var(--font-mono)', fontSize: 'var(--text-base)', fontWeight: 500,
    border: '1px solid var(--border-strong)',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#000' : 'var(--text-muted)',
    WebkitTapHighlightColor: 'transparent',
    transition: 'all var(--dur-hover) var(--ease)',
  })

  function handleSetA() {
    if (loopA != null) {
      setLoopAState(null)
      engine.setLoopEnabled(false)
    } else {
      const t = engine.currentTime
      setLoopAState(t)
      engine.setLoopPoints(t, loopB ?? engine.duration)
    }
  }

  function handleSetB() {
    if (loopB != null) {
      setLoopBState(null)
      engine.setLoopEnabled(false)
    } else {
      const t = engine.currentTime
      setLoopBState(t)
      const a = loopA ?? 0
      engine.setLoopPoints(a, t)
      if (loopA != null) engine.setLoopEnabled(true)
    }
  }

  const repeatColor = repeatMode !== 'off' ? 'var(--text-primary)' : 'var(--text-muted)'
  const shuffleColor = shuffle ? 'var(--text-primary)' : 'var(--text-muted)'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', animation: 'mvSlideUp 220ms var(--ease)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, height: 56, display: 'flex', alignItems: 'center', padding: '0 8px' }}>
        <button onClick={onClose} style={TAP}>
          <ChevronDown size={24} style={{ color: 'var(--text-secondary)' }} />
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span className="mv-label">{track?.project_name || 'Now Playing'}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {onShare && (
            <button onClick={onShare} style={TAP}>
              <Share2 size={20} style={{ color: 'var(--text-secondary)' }} />
            </button>
          )}
          <button onClick={onEditMeta} style={TAP}>
            <Pencil size={18} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button onClick={handleDownload} disabled={engine.isCached || downloading} style={{ ...TAP, opacity: engine.isCached ? 0.4 : 1 }}>
            {downloading
              ? <div style={{ width: 18, height: 18, border: '2px solid var(--text-muted)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              : <ArrowDownToLine size={18} style={{ color: engine.isCached ? 'var(--text-muted)' : 'var(--text-secondary)' }} />}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 24px', display: 'flex', flexDirection: 'column' }}>
        {/* Cover — tap to upload */}
        <input ref={coverInputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadCover.mutate(f) }} />
        <div
          onClick={() => coverInputRef.current?.click()}
          style={{ width: '100%', maxWidth: 320, aspectRatio: '1', alignSelf: 'center', borderRadius: 'var(--radius-lg)', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, marginTop: 4, overflow: 'hidden', cursor: 'pointer', position: 'relative' }}>
          {track?.project_cover_url ? (
            <img src={track.project_cover_url} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Music2 size={56} strokeWidth={1} style={{ color: 'var(--text-muted)' }} />
          )}
          <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.6)', borderRadius: 'var(--radius-full)', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Camera size={12} style={{ color: '#fff' }} />
            <span style={{ fontSize: 10, color: '#fff' }}>{track?.project_cover_url ? 'Change' : 'Add cover'}</span>
          </div>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 16 }}>
          <div className="mv-track-title" style={{ fontSize: 'var(--text-xl)' }}>{track?.name}</div>
          <div className="mv-meta" style={{ marginTop: 4 }}>{track?.artist || 'Unknown artist'}{track?.album ? ` · ${track.album}` : ''}{track?.year ? ` · ${track.year}` : ''}</div>
        </div>

        {/* Waveform */}
        <div style={{ height: 72 }}>
          <WaveCanvas
            peaks={engine.peaks} currentTime={engine.currentTime} duration={engine.duration}
            onSeek={(t) => engine.seek(t)}
            onScrubStart={handleScrubStart}
            onScrubEnd={handleScrubEnd}
            loopA={loopA ?? 0}
            loopB={loopB ?? engine.duration}
            loopEnabled={loopA != null && loopB != null}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, marginBottom: 16 }}>
          <span className="mv-mono">{fmt(engine.currentTime)}</span>
          <span className="mv-mono">{fmt(engine.duration)}</span>
        </div>

        {/* Transport */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 20 }}>
          <button onClick={onSkipPrev} style={TAP}>
            <SkipBack size={26} strokeWidth={1.75} style={{ color: 'var(--text-primary)' }} />
          </button>
          <button onClick={() => engine.playing ? engine.pause() : engine.play()} style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--accent)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent', flexShrink: 0 }}>
            {engine.playing
              ? <Pause size={28} strokeWidth={2} style={{ color: '#000' }} />
              : <Play size={28} strokeWidth={2} style={{ color: '#000', marginLeft: 3 }} />}
          </button>
          <button onClick={onSkipNext} style={TAP}>
            <SkipForward size={26} strokeWidth={1.75} style={{ color: 'var(--text-primary)' }} />
          </button>
        </div>

        {/* A-B loop + repeat + shuffle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
          <span className="mv-label" style={{ marginRight: 2 }}>Loop</span>
          <button onClick={handleSetA} style={loopBtn(loopA != null)}>A</button>
          <button onClick={handleSetB} style={loopBtn(loopB != null)}>B</button>
          <div style={{ flex: 1 }} />
          <button onClick={onToggleRepeat} style={{ ...TAP, color: repeatColor, position: 'relative' }}>
            <Repeat size={20} strokeWidth={1.75} />
            {repeatMode === 'one' && (
              <span style={{ position: 'absolute', top: 6, right: 6, fontSize: 8, fontWeight: 700, lineHeight: 1, color: repeatColor }}>1</span>
            )}
          </button>
          <button onClick={onToggleShuffle} style={{ ...TAP, color: shuffleColor }}>
            <Shuffle size={20} strokeWidth={1.75} />
          </button>
        </div>

        {/* Volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Volume2 size={18} strokeWidth={1.5} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <Slider value={engine.volume} min={0} max={1} step={0.01}
              onChange={engine.setVolume} onReset={() => engine.setVolume(0.8)} />
          </div>
        </div>

        {/* Pitch + Speed */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span className="mv-label">Pitch</span>
              <span className="mv-mono" style={{ fontSize: 'var(--text-xs)' }}>{engine.pitch > 0 ? '+' : ''}{engine.pitch} st</span>
            </div>
            <Slider value={engine.pitch} min={-12} max={12} step={1}
              onChange={(v) => engine.setPitch(Math.round(v))} onReset={() => engine.setPitch(0)} />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span className="mv-label">Speed</span>
              <span className="mv-mono" style={{ fontSize: 'var(--text-xs)' }}>{engine.speed.toFixed(2)}×</span>
            </div>
            <Slider value={engine.speed} min={0.5} max={1.5} step={0.05}
              onChange={engine.setSpeed} onReset={() => engine.setSpeed(1)} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Projects tab ───────────────────────────────────────────────────────── */
function ProjectsTab({ onPick }) {
  const matchProj = useMatch('/project/:id')
  const activeId = matchProj?.params?.id
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
  })
  const { data: allTracks = [] } = useQuery({
    queryKey: ['tracks-all'],
    queryFn: () => Promise.all(projects.map(p =>
      api.get(`/tracks/project/${p.id}`).then(r => ({ id: p.id, count: r.data.length }))
    )),
    enabled: projects.length > 0,
  })
  const counts = Object.fromEntries((allTracks || []).map(t => [t.id, t.count]))

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
      <div style={{ padding: '20px 16px 12px' }}>
        <h1 className="mv-h2">Projects</h1>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, padding: '0 12px 32px' }}>
        {projects.map(p => {
          const coverUrl = p.cover_path ? `/covers/${p.cover_path.split('/').pop()}` : null
          const isActive = activeId === String(p.id)
          return (
            <button
              key={p.id}
              onClick={() => onPick(p.id)}
              style={{
                display: 'flex', flexDirection: 'column', padding: 0, border: 'none',
                background: 'transparent', cursor: 'pointer', textAlign: 'left',
                WebkitTapHighlightColor: 'transparent', borderRadius: 'var(--radius-lg)',
                outline: isActive ? '2px solid rgba(255,255,255,0.3)' : 'none',
                outlineOffset: 2,
              }}
            >
              {/* Square cover */}
              <div style={{
                width: '100%', aspectRatio: '1', borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                {coverUrl
                  ? <img src={coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `hsl(${(p.id * 73) % 360},18%,14%)` }}>
                      <Disc3 size={36} strokeWidth={1} style={{ color: 'rgba(255,255,255,0.2)' }} />
                    </div>
                  )}
                {/* Track count pill */}
                <div style={{
                  position: 'absolute', bottom: 8, right: 8,
                  background: 'rgba(0,0,0,0.6)', borderRadius: 'var(--radius-full)',
                  padding: '2px 8px', fontSize: 10, color: 'rgba(255,255,255,0.75)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {counts[p.id] ?? '…'}
                </div>
              </div>
              {/* Name */}
              <div style={{ padding: '8px 4px 4px' }}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: 'var(--text-sm)', fontWeight: 500,
                  color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{p.name}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SearchTab() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="mv-meta">Search coming soon.</span>
    </div>
  )
}

/* ── Mobile shell ─────────────────────────────────────────────────────────── */
export default function MobileLayout() {
  const [tab, setTab] = useState('library')
  const [expanded, setExpanded] = useState(false)
  const [shareTrack, setShareTrack] = useState(null)
  const [showMeta, setShowMeta] = useState(false)
  const [repeatMode, setRepeatMode] = useState('off') // 'off' | 'one' | 'all'
  const [shuffle, setShuffle] = useState(false)
  const navigate = useNavigate()
  const matchProj = useMatch('/project/:id')
  const activeProjectId = matchProj?.params?.id

  const { currentTrack, playNext, playPrev, playRandom } = usePlayer()
  const engine = useAudioEngine()

  // Refs for stable Media Session handlers
  const engineRef = useRef(engine)
  const skipNextRef = useRef(null)
  const skipPrevRef = useRef(null)
  engineRef.current = engine

  function handleSkipNext() {
    shuffle ? playRandom() : playNext()
  }
  function handleSkipPrev() { playPrev() }
  skipNextRef.current = handleSkipNext
  skipPrevRef.current = handleSkipPrev

  // Load track when it changes — cancel flag prevents stale play() if track changes mid-load
  useEffect(() => {
    if (!currentTrack) return
    let cancelled = false
    engine.loadTrack(currentTrack.id).then(() => {
      if (!cancelled) engine.play(0)
    })
    return () => { cancelled = true }
  }, [currentTrack?.id])

  // Repeat: when track finishes, decide what to do
  const prevPlayingRef = useRef(false)
  useEffect(() => {
    const ended = prevPlayingRef.current && !engine.playing &&
      engine.duration > 0 && engine.currentTime >= engine.duration - 0.2
    if (ended) {
      if (repeatMode === 'one') {
        engine.play(0)
      } else if (repeatMode === 'all') {
        handleSkipNext()
      }
    }
    prevPlayingRef.current = engine.playing
  }, [engine.playing])

  // Media Session: register handlers once
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const actions = {
      play: () => engineRef.current.play(),
      pause: () => engineRef.current.pause(),
      stop: () => engineRef.current.pause(),
      previoustrack: () => skipPrevRef.current?.(),
      nexttrack: () => skipNextRef.current?.(),
      seekto: (d) => engineRef.current.seek(d.seekTime),
      seekbackward: (d) => engineRef.current.seek(Math.max(0, engineRef.current.currentTime - (d.seekOffset || 10))),
      seekforward: (d) => engineRef.current.seek(Math.min(engineRef.current.duration, engineRef.current.currentTime + (d.seekOffset || 10))),
    }
    Object.entries(actions).forEach(([a, h]) => {
      try { navigator.mediaSession.setActionHandler(a, h) } catch {}
    })
  }, [])

  // Media Session: metadata
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return
    const artwork = currentTrack.project_cover_url
      ? [{ src: currentTrack.project_cover_url, sizes: '512x512' }]
      : []
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.name || 'Unknown',
      artist: currentTrack.artist || '',
      album: currentTrack.album || currentTrack.project_name || '',
      artwork,
    })
  }, [currentTrack])

  // Media Session: playback state
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = engine.playing ? 'playing' : 'paused'
  }, [engine.playing])

  // Media Session: position state
  useEffect(() => {
    if (!('mediaSession' in navigator) || !engine.duration) return
    try {
      navigator.mediaSession.setPositionState({
        duration: engine.duration,
        playbackRate: engine.speed,
        position: Math.min(engine.currentTime, engine.duration),
      })
    } catch {}
  }, [engine.currentTime])

  const { data: project } = useQuery({
    queryKey: ['project', activeProjectId],
    queryFn: () => api.get(`/projects/${activeProjectId}`).then(r => r.data),
    enabled: !!activeProjectId,
  })
  const { data: tracks = [] } = useQuery({
    queryKey: ['tracks', activeProjectId],
    queryFn: () => api.get(`/tracks/project/${activeProjectId}`).then(r => r.data),
    enabled: !!activeProjectId,
  })

  function handleTabChange(id) {
    if (id === 'upload') return
    setTab(id)
    if (id === 'library' && !activeProjectId) navigate('/')
  }

  function handlePickProject(id) {
    navigate(`/project/${id}`)
    setTab('library')
  }

  function toggleRepeat() {
    setRepeatMode(m => m === 'off' ? 'one' : m === 'one' ? 'all' : 'off')
  }

  const headerTitle = tab === 'search' ? 'Search' : tab === 'projects' ? 'MusicVault' : (project?.name || 'MusicVault')
  const headerSub = tab === 'library' && tracks.length > 0 ? `${tracks.length} track${tracks.length !== 1 ? 's' : ''}` : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header style={{ flexShrink: 0, height: 52, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-base)', fontWeight: 600, letterSpacing: 'var(--tracking-display)', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {headerTitle}
          </div>
          {headerSub && <div className="mv-meta" style={{ fontSize: 'var(--text-xs)' }}>{headerSub}</div>}
        </div>
        {tab === 'library' && project && (
          <button onClick={() => setShareTrack(null)} style={TAP}>
            <Share2 size={20} style={{ color: 'var(--text-secondary)' }} />
          </button>
        )}
      </header>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'search' ? (
          <SearchTab />
        ) : tab === 'projects' ? (
          <ProjectsTab onPick={handlePickProject} />
        ) : (
          <Outlet />
        )}
      </div>

      <MiniPlayer track={currentTrack} engine={engine} onExpand={() => setExpanded(true)} onSkipNext={handleSkipNext} />
      <BottomNav tab={tab} setTab={handleTabChange} />

      {expanded && (
        <FullScreenPlayer
          track={currentTrack}
          engine={engine}
          onClose={() => setExpanded(false)}
          onShare={currentTrack ? () => { setShareTrack(currentTrack); setExpanded(false) } : null}
          onEditMeta={() => setShowMeta(true)}
          repeatMode={repeatMode}
          onToggleRepeat={toggleRepeat}
          shuffle={shuffle}
          onToggleShuffle={() => setShuffle(s => !s)}
          onSkipNext={handleSkipNext}
          onSkipPrev={handleSkipPrev}
        />
      )}

      {showMeta && currentTrack && (
        <MetadataSheet track={currentTrack} onClose={() => setShowMeta(false)} />
      )}

      {shareTrack && <ShareModal track={shareTrack} onClose={() => setShareTrack(null)} />}
    </div>
  )
}
