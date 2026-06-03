import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useMatch } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Menu, X, Play, Pause, SkipBack, SkipForward,
  ChevronDown, ChevronUp, Music2, Plus, LogOut,
} from 'lucide-react'
import { usePlayer } from '../hooks/usePlayer'
import { useAudioEngine } from '../hooks/useAudioEngine'
import { useAuth } from '../hooks/useAuth'
import { useSSEStatus } from '../hooks/useSSE'
import api from '../api/client'
import WaveCanvas from '../components/Player/WaveCanvas'

function fmt(s) {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function DrawerOverlay({ onClose }) {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { connected } = useSSEStatus()
  const qc = useQueryClient()
  const matchProj = useMatch('/project/:id')
  const activeId = matchProj?.params?.id
  const [newName, setNewName] = useState('')
  const [showNew, setShowNew] = useState(false)

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
  })

  const createProject = useMutation({
    mutationFn: name => api.post('/projects', { name }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      setShowNew(false); setNewName('')
      navigate(`/project/${res.data.id}`)
      onClose()
    },
  })

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40, backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 280,
        background: 'var(--bg-secondary)', zIndex: 50,
        display: 'flex', flexDirection: 'column', padding: '0 12px',
        borderRight: '1px solid var(--border)',
      }}>
        <div style={{ padding: '20px 10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>MusicVault</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, lineHeight: 0 }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', marginBottom: 8 }}>
              <span className="mv-label">PROJECTS</span>
              <button onClick={() => setShowNew(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, lineHeight: 0 }}>
                <Plus size={13} strokeWidth={1.5} />
              </button>
            </div>
            {showNew && (
              <form onSubmit={e => { e.preventDefault(); if (newName.trim()) createProject.mutate(newName.trim()) }} style={{ padding: '0 10px', marginBottom: 8 }}>
                <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Project name"
                  style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-ui)' }} />
              </form>
            )}
            {projects.map(p => (
              <button key={p.id} onClick={() => { navigate(`/project/${p.id}`); onClose() }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 10px', borderRadius: 'var(--radius-md)', border: 'none', background: activeId === String(p.id) ? 'var(--accent-subtle)' : 'transparent', color: activeId === String(p.id) ? 'var(--text-primary)' : 'var(--text-secondary)', fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? '#4ade80' : '#444' }} />
            <span className="mv-meta" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{connected ? 'Live' : 'Connecting…'}</span>
          </div>
          <button onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, lineHeight: 0 }}>
            <LogOut size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </>
  )
}

// Single component owns the audio engine — avoids two separate instances
function MobilePlayer() {
  const { currentTrack, playNext, playPrev } = usePlayer()
  const engine = useAudioEngine()
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!currentTrack) return
    engine.loadTrack(currentTrack.id).then(() => engine.play(0))
  }, [currentTrack?.id])

  if (!currentTrack) return null

  const progress = engine.duration > 0 ? engine.currentTime / engine.duration : 0

  if (expanded) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 45, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', padding: '0 24px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0' }}>
          <button onClick={() => setExpanded(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, lineHeight: 0 }}>
            <ChevronDown size={20} strokeWidth={1.5} />
          </button>
          <span className="mv-label">NOW PLAYING</span>
          <div style={{ width: 28 }} />
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 0' }}>
          <div style={{ width: '100%', maxWidth: 280, aspectRatio: '1', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Music2 size={56} strokeWidth={1} style={{ color: 'var(--text-muted)' }} />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentTrack.name}
          </div>
          <div className="mv-meta">{currentTrack.artist || 'Unknown artist'}</div>
        </div>

        <div style={{ height: 64, marginBottom: 8 }}>
          <WaveCanvas peaks={engine.peaks} currentTime={engine.currentTime} duration={engine.duration} onSeek={t => engine.seek(t)} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28 }}>
          <span className="mv-mono" style={{ fontSize: 'var(--text-xs)' }}>{fmt(engine.currentTime)}</span>
          <span className="mv-mono" style={{ fontSize: 'var(--text-xs)' }}>{fmt(engine.duration)}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          <button onClick={playPrev} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 8, lineHeight: 0 }}>
            <SkipBack size={22} strokeWidth={1.5} />
          </button>
          <button onClick={() => engine.playing ? engine.pause() : engine.play()}
            style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--accent)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
            {engine.playing ? <Pause size={22} strokeWidth={1.5} /> : <Play size={22} strokeWidth={1.5} style={{ marginLeft: 2 }} />}
          </button>
          <button onClick={playNext} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 8, lineHeight: 0 }}>
            <SkipForward size={22} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30, background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)' }}>
      <div style={{ height: 2, background: 'var(--waveform-inactive)' }}>
        <div style={{ height: '100%', width: `${progress * 100}%`, background: 'var(--accent)', transition: 'width 0.2s linear' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', gap: 12 }}>
        <button onClick={() => setExpanded(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 0, flexShrink: 0 }}>
          <ChevronUp size={16} strokeWidth={1.5} />
        </button>
        <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Music2 size={14} strokeWidth={1} style={{ color: 'var(--text-muted)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentTrack.name}
          </div>
          <div className="mv-mono" style={{ fontSize: 10 }}>{fmt(engine.currentTime)} / {fmt(engine.duration)}</div>
        </div>
        <button onClick={playPrev} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 6, lineHeight: 0 }}>
          <SkipBack size={16} strokeWidth={1.5} />
        </button>
        <button onClick={() => engine.playing ? engine.pause() : engine.play()}
          style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-tertiary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--text-primary)' }}>
          {engine.playing ? <Pause size={16} strokeWidth={1.5} /> : <Play size={16} strokeWidth={1.5} style={{ marginLeft: 1 }} />}
        </button>
        <button onClick={playNext} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 6, lineHeight: 0 }}>
          <SkipForward size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}

export default function MobileLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { currentTrack } = usePlayer()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg-secondary)' }}>
        <button onClick={() => setDrawerOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, lineHeight: 0, marginRight: 12 }}>
          <Menu size={20} strokeWidth={1.5} />
        </button>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>MusicVault</span>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', paddingBottom: currentTrack ? 68 : 0 }}>
        <Outlet />
      </div>

      <MobilePlayer />

      {drawerOpen && <DrawerOverlay onClose={() => setDrawerOpen(false)} />}
    </div>
  )
}
