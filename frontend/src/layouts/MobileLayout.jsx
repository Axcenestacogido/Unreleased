import { useState, useEffect, useRef, useCallback } from 'react'
import { Outlet, useNavigate, useMatch } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Play, Pause, SkipBack, SkipForward, ChevronDown,
  Music2, House, Disc3, Search, Upload, Repeat, Shuffle, Volume2,
  Share2, ChevronRight,
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
    drag(e.clientX)
    const move = (ev) => drag(ev.clientX)
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }, [drag])
  return (
    <div ref={ref} onMouseDown={onMouseDown} onDoubleClick={onReset}
      style={{ position: 'relative', height: 14, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'var(--waveform-inactive)', borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 2, background: 'var(--accent)', borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: `${pct}%`, width: 10, height: 10, marginLeft: -5, borderRadius: '50%', background: 'var(--accent)' }} />
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
function MiniPlayer({ track, engine, onExpand }) {
  if (!track) return null
  const progress = engine.duration > 0 ? engine.currentTime / engine.duration : 0
  const { playNext } = usePlayer()
  return (
    <div onClick={onExpand} style={{
      flexShrink: 0, height: 64, background: 'var(--bg-tertiary)',
      borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center',
      gap: 12, padding: '0 8px 0 14px', cursor: 'pointer', position: 'relative',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--waveform-inactive)' }}>
        <div style={{ height: '100%', width: `${progress * 100}%`, background: 'var(--accent)' }} />
      </div>
      <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', flexShrink: 0, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
        <Music2 size={18} strokeWidth={1} style={{ color: 'var(--text-muted)' }} />
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
      <button onClick={(e) => { e.stopPropagation(); playNext() }} style={TAP}>
        <SkipForward size={20} strokeWidth={1.75} style={{ color: 'var(--text-secondary)' }} />
      </button>
    </div>
  )
}

/* ── Fullscreen player ───────────────────────────────────────────────────── */
function FullScreenPlayer({ track, engine, onClose, onShare }) {
  const { playNext, playPrev } = usePlayer()
  const progress = engine.duration > 0 ? engine.currentTime / engine.duration : 0
  const [loopA, setLoopA] = useState(null)
  const [loopB, setLoopB] = useState(null)
  const [volume, setVolume] = useState(0.8)

  const loopABtn = (active) => ({
    width: 40, height: 36, borderRadius: 'var(--radius-sm)', cursor: 'pointer',
    fontFamily: 'var(--font-mono)', fontSize: 'var(--text-base)', fontWeight: 500,
    border: '1px solid var(--border-strong)',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#000' : 'var(--text-muted)',
    WebkitTapHighlightColor: 'transparent',
    transition: 'all var(--dur-hover) var(--ease)',
  })

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
        {onShare && (
          <button onClick={onShare} style={TAP}>
            <Share2 size={20} style={{ color: 'var(--text-secondary)' }} />
          </button>
        )}
        {!onShare && <div style={{ width: 44 }} />}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 24px', display: 'flex', flexDirection: 'column' }}>
        {/* Cover */}
        <div style={{ width: '100%', maxWidth: 360, aspectRatio: '1', alignSelf: 'center', borderRadius: 'var(--radius-lg)', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, marginTop: 8 }}>
          <Music2 size={56} strokeWidth={1} style={{ color: 'var(--text-muted)' }} />
        </div>

        {/* Title */}
        <div style={{ marginBottom: 20 }}>
          <div className="mv-track-title" style={{ fontSize: 'var(--text-xl)' }}>{track?.name}</div>
          <div className="mv-meta" style={{ marginTop: 4 }}>{track?.artist || 'Unknown artist'}</div>
        </div>

        {/* Waveform */}
        <div style={{ height: 88 }}>
          <WaveCanvas
            peaks={engine.peaks} currentTime={engine.currentTime} duration={engine.duration}
            onSeek={(t) => engine.seek(t)}
            loopA={loopA != null ? loopA * engine.duration : 0}
            loopB={loopB != null ? loopB * engine.duration : engine.duration}
            loopEnabled={loopA != null && loopB != null}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, marginBottom: 20 }}>
          <span className="mv-mono">{fmt(engine.currentTime)}</span>
          <span className="mv-mono">{fmt(engine.duration)}</span>
        </div>

        {/* Transport */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 24 }}>
          <button onClick={playPrev} style={TAP}>
            <SkipBack size={26} strokeWidth={1.75} style={{ color: 'var(--text-primary)' }} />
          </button>
          <button onClick={() => engine.playing ? engine.pause() : engine.play()} style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--accent)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' }}>
            {engine.playing
              ? <Pause size={28} strokeWidth={2} style={{ color: '#000' }} />
              : <Play size={28} strokeWidth={2} style={{ color: '#000', marginLeft: 3 }} />}
          </button>
          <button onClick={playNext} style={TAP}>
            <SkipForward size={26} strokeWidth={1.75} style={{ color: 'var(--text-primary)' }} />
          </button>
        </div>

        {/* A-B loop + repeat/shuffle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 24 }}>
          <span className="mv-label" style={{ marginRight: 4 }}>Loop</span>
          <button onClick={() => setLoopA(loopA == null ? progress : null)} style={loopABtn(loopA != null)}>A</button>
          <button onClick={() => setLoopB(loopB == null ? Math.min(1, progress + 0.15) : null)} style={loopABtn(loopB != null)}>B</button>
          <div style={{ width: 16 }} />
          <button style={TAP}><Repeat size={18} style={{ color: 'var(--text-muted)' }} /></button>
          <button style={TAP}><Shuffle size={18} style={{ color: 'var(--text-muted)' }} /></button>
        </div>

        {/* Volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Volume2 size={18} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
          <div style={{ flex: 1 }}>
            <Slider value={volume} min={0} max={1} step={0.01} onChange={setVolume} onReset={() => setVolume(0.8)} />
          </div>
        </div>

        {/* Pitch + Speed */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span className="mv-label">Pitch</span>
              <span className="mv-mono" style={{ fontSize: 'var(--text-xs)' }}>{engine.pitch > 0 ? '+' : ''}{engine.pitch} st</span>
            </div>
            <Slider value={engine.pitch} min={-12} max={12} step={1} onChange={(v) => engine.setPitch(Math.round(v))} onReset={() => engine.setPitch(0)} />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span className="mv-label">Speed</span>
              <span className="mv-mono" style={{ fontSize: 'var(--text-xs)' }}>{engine.speed.toFixed(2)}×</span>
            </div>
            <Slider value={engine.speed} min={0.5} max={1.5} step={0.05} onChange={engine.setSpeed} onReset={() => engine.setSpeed(1)} />
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
    queryFn: () => Promise.all(projects.map(p => api.get(`/tracks/project/${p.id}`).then(r => ({ id: p.id, count: r.data.length })))),
    enabled: projects.length > 0,
  })
  const counts = Object.fromEntries((allTracks || []).map(t => [t.id, t.count]))

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
      <div style={{ padding: '20px 16px 8px' }}>
        <h1 className="mv-h2">Projects</h1>
      </div>
      <div style={{ padding: '4px 8px 16px' }}>
        {projects.map(p => (
          <button key={p.id} onClick={() => onPick(p.id)} style={{
            display: 'flex', alignItems: 'center', gap: 14, width: '100%',
            padding: '14px 12px', border: 'none', cursor: 'pointer', textAlign: 'left',
            background: activeId === String(p.id) ? 'var(--accent-subtle)' : 'transparent',
            borderRadius: 'var(--radius-md)', WebkitTapHighlightColor: 'transparent',
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', flexShrink: 0, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Disc3 size={20} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mv-ui" style={{ color: 'var(--text-primary)' }}>{p.name}</div>
              <div className="mv-meta" style={{ fontSize: 'var(--text-xs)' }}>{counts[p.id] ?? '…'} tracks</div>
            </div>
            <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Search tab placeholder ─────────────────────────────────────────────── */
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
  const navigate = useNavigate()
  const matchProj = useMatch('/project/:id')
  const activeProjectId = matchProj?.params?.id

  const { currentTrack } = usePlayer()
  const engine = useAudioEngine()

  // Load track when it changes
  useEffect(() => {
    if (!currentTrack) return
    engine.loadTrack(currentTrack.id).then(() => engine.play(0))
  }, [currentTrack?.id])

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
    if (id === 'upload') return  // UploadZone is inline in TrackList
    setTab(id)
    if (id === 'library' && !activeProjectId) navigate('/')
  }

  function handlePickProject(id) {
    navigate(`/project/${id}`)
    setTab('library')
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

      {/* Mini player */}
      <MiniPlayer track={currentTrack} engine={engine} onExpand={() => setExpanded(true)} />

      {/* Bottom nav */}
      <BottomNav tab={tab} setTab={handleTabChange} />

      {/* Full player */}
      {expanded && (
        <FullScreenPlayer
          track={currentTrack}
          engine={engine}
          onClose={() => setExpanded(false)}
          onShare={currentTrack ? () => { setShareTrack(currentTrack); setExpanded(false) } : null}
        />
      )}

      {shareTrack && <ShareModal track={shareTrack} onClose={() => setShareTrack(null)} />}
    </div>
  )
}
