import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Share2, Trash2, History, Upload, FolderInput, Share, Mic, Plus, MoreHorizontal, Music2, Camera, ChevronLeft, Play, Lock, Clock } from 'lucide-react'
import api from '../../api/client'
import { usePlayer } from '../../hooks/usePlayer'
import MoveTrackModal from './MoveTrackModal'
import UploadZone from './UploadZone'

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(str) {
  if (!str) return ''
  const d = new Date(str)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmt(s) {
  if (!s || isNaN(s)) return ''
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function Equalizer() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 12, flexShrink: 0 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 2, background: 'var(--waveform-active)', borderRadius: 1,
          animation: `mvEq 0.9s ${i * 0.18}s ease-in-out infinite alternate`,
          display: 'block',
        }} />
      ))}
    </div>
  )
}

// 3-dots context menu
function TrackMenu({ track, onShare, onNewVersion, onMove, onClose }) {
  const qc = useQueryClient()
  const menuRef = useRef(null)

  const deleteTrack = useMutation({
    mutationFn: () => api.delete(`/tracks/${track.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tracks', String(track.project_id)] })
      onClose()
    },
  })

  const items = [
    { icon: <Upload size={13} strokeWidth={1.5} />, label: 'Nueva versión', action: () => { onNewVersion(track); onClose() } },
    { icon: <FolderInput size={13} strokeWidth={1.5} />, label: 'Mover a…', action: () => { onMove(track); onClose() } },
    { icon: <Share2 size={13} strokeWidth={1.5} />, label: 'Compartir', action: () => { onShare(track); onClose() } },
    {
      icon: <Trash2 size={13} strokeWidth={1.5} />, label: 'Eliminar', danger: true,
      action: () => { if (window.confirm('¿Eliminar esta canción?')) deleteTrack.mutate(); onClose() }
    },
  ]

  return (
    <div
      ref={menuRef}
      style={{
        position: 'absolute', right: 0, top: '100%', zIndex: 50,
        background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-lg)', padding: '6px 0',
        boxShadow: 'var(--shadow-modal)', minWidth: 160,
        animation: 'mvScaleIn 120ms var(--ease)',
      }}
      onClick={e => e.stopPropagation()}
    >
      {items.map((item, i) => (
        <button key={i} onClick={item.action}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', padding: '9px 14px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: item.danger ? '#f87171' : 'var(--text-primary)',
            fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', textAlign: 'left',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ color: item.danger ? '#f87171' : 'var(--text-muted)' }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  )
}

function TrackRow({ track, allTracks, isActive, isPlaying, onShare, onNewVersion, onMove, index }) {
  const { play } = usePlayer()
  const [menuOpen, setMenuOpen] = useState(false)

  const menuBtnRef = useRef(null)
  const listenerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (listenerRef.current) document.removeEventListener('click', listenerRef.current)
    }
  }, [])

  function openMenu(e) {
    e.stopPropagation()
    const willOpen = !menuOpen
    setMenuOpen(willOpen)
    if (willOpen) {
      listenerRef.current = (ev) => {
        if (menuBtnRef.current && !menuBtnRef.current.contains(ev.target)) {
          setMenuOpen(false)
          document.removeEventListener('click', listenerRef.current)
          listenerRef.current = null
        }
      }
      setTimeout(() => document.addEventListener('click', listenerRef.current), 0)
    } else if (listenerRef.current) {
      document.removeEventListener('click', listenerRef.current)
      listenerRef.current = null
    }
  }

  return (
    <div
      onClick={() => play(track, allTracks)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '12px 20px', cursor: 'pointer', position: 'relative',
        transition: `background var(--dur-hover) var(--ease)`,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      {/* Index or equalizer */}
      <div style={{ width: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isActive && isPlaying
          ? <Equalizer />
          : <span style={{ fontSize: 14, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{index + 1}</span>
        }
      </div>

      {/* Title + date */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 16, fontWeight: 600,
          color: isActive ? 'var(--accent)' : 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {track.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
          <Clock size={11} strokeWidth={1.5} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
            {formatDate(track.created_at)}
            {track.bpm ? ` · ${track.bpm} BPM` : ''}
            {track.key_signature ? ` · ${track.key_signature}` : ''}
          </span>
        </div>
      </div>

      {/* 3-dots menu */}
      <div ref={menuBtnRef} style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        <button onClick={openMenu} style={{
          width: 32, height: 32, borderRadius: 8, border: 'none',
          background: menuOpen ? 'var(--bg-elevated)' : 'transparent',
          color: 'var(--text-muted)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MoreHorizontal size={18} strokeWidth={1.5} />
        </button>
        {menuOpen && (
          <TrackMenu track={track} onShare={onShare} onNewVersion={onNewVersion} onMove={onMove} onClose={() => setMenuOpen(false)} />
        )}
      </div>
    </div>
  )
}

function NewVersionModal({ track, onClose }) {
  const qc = useQueryClient()
  const [note, setNote] = useState('')
  const [hover, setHover] = useState(false)

  const upload = useMutation({
    mutationFn: ({ file, note }) => {
      const form = new FormData()
      form.append('file', file)
      if (note) form.append('note', note)
      return api.post(`/tracks/${track.id}/version`, form)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tracks', String(track.project_id)] }); onClose() },
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-xl)', padding: 24, width: '100%', maxWidth: 360, boxShadow: 'var(--shadow-modal)' }} onClick={e => e.stopPropagation()}>
        <h3 className="mv-ui" style={{ fontWeight: 500, marginBottom: 16 }}>Nueva versión — {track.name}</h3>
        <label
          onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
          style={{ display: 'block', border: `1.5px dashed ${hover ? 'var(--border-strong)' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', padding: '20px 16px', textAlign: 'center', cursor: 'pointer', transition: `border-color var(--dur-hover) var(--ease)` }}>
          <input type="file" accept="audio/*,.mp3,.wav,.flac,.aac,.ogg,.m4a" style={{ display: 'none' }}
            onChange={e => { const file = e.target.files[0]; if (file) upload.mutate({ file, note }) }} />
          <Upload size={18} style={{ margin: '0 auto 8px', color: 'var(--text-muted)', display: 'block' }} strokeWidth={1.5} />
          <p className="mv-meta" style={{ fontSize: 'var(--text-xs)' }}>Selecciona un archivo de audio</p>
        </label>
        <input
          style={{ marginTop: 10, width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 12px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-ui)' }}
          placeholder="Nota de versión (opcional)" value={note} onChange={e => setNote(e.target.value)} />
        {upload.isError && <p style={{ color: '#f87171', fontSize: 'var(--text-xs)', marginTop: 8 }}>Error al subir</p>}
        <button onClick={onClose} style={{ marginTop: 10, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-ui)' }}>Cancelar</button>
      </div>
    </div>
  )
}

function fmtTotal(secs) {
  if (!secs) return ''
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${h}h ${m % 60}m`
  }
  return `${m}m ${s}s`
}

export default function TrackList({ projectId, folderId, project, onShare, onShareProject, onRecord, onAnalytics }) {
  const { currentTrack, play, playing } = usePlayer()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [newVersionTrack, setNewVersionTrack] = useState(null)
  const [moveTrack, setMoveTrack] = useState(null)
  const coverInputRef = useRef()
  const uploadZoneRef = useRef()

  const { data: tracks = [] } = useQuery({
    queryKey: ['tracks', projectId, folderId],
    queryFn: () => api.get(`/tracks/project/${projectId}`, { params: folderId != null ? { folder_id: folderId } : {} }).then(r => r.data),
    enabled: !!projectId,
  })

  const totalSeconds = tracks.reduce((sum, t) => {
    const v = t.versions?.[t.versions.length - 1]
    return sum + (v?.duration || 0)
  }, 0)

  function handleCoverUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      api.patch(`/projects/${projectId}`, { cover_image: ev.target.result })
        .then(() => qc.invalidateQueries({ queryKey: ['project', projectId] }))
    }
    reader.readAsDataURL(file)
  }

  const gradients = [
    'linear-gradient(135deg,#667eea,#764ba2)',
    'linear-gradient(135deg,#f093fb,#f5576c)',
    'linear-gradient(135deg,#4facfe,#00f2fe)',
    'linear-gradient(135deg,#43e97b,#38f9d7)',
    'linear-gradient(135deg,#fa709a,#fee140)',
    'linear-gradient(135deg,#a18cd1,#fbc2eb)',
    'linear-gradient(135deg,#ffecd2,#fcb69f)',
    'linear-gradient(135deg,#30cfd0,#330867)',
  ]
  const grad = project ? gradients[project.id % gradients.length] : 'var(--bg-tertiary)'

  const coverBtn = (onClick, title, children) => (
    <button onClick={onClick} title={title} style={{
      width: 38, height: 38, borderRadius: 10, border: 'none',
      background: 'rgba(0,0,0,0.45)', color: '#fff', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(8px)',
    }}>{children}</button>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Project header ── */}
      {project && (
        <div style={{ flexShrink: 0, overflowY: 'auto' }}>

          {/* Square cover art */}
          <div style={{ padding: '16px 20px 0', position: 'relative' }}>
            <div style={{
              width: '100%', aspectRatio: '1', borderRadius: 20, overflow: 'hidden',
              background: project.cover_image ? undefined : grad,
              position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {project.cover_image
                ? <img src={project.cover_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <Music2 size={64} strokeWidth={1} style={{ color: 'rgba(255,255,255,0.4)' }} />
              }

              {/* Back — top left */}
              <button onClick={() => navigate('/')} style={{
                position: 'absolute', top: 14, left: 14,
                width: 38, height: 38, borderRadius: 10, border: 'none',
                background: 'rgba(0,0,0,0.45)', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(8px)',
              }}>
                <ChevronLeft size={20} strokeWidth={2} />
              </button>

              {/* Action buttons — top right */}
              <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 8 }}>
                <input ref={coverInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverUpload} />
                {coverBtn(() => coverInputRef.current?.click(), 'Cambiar portada', <Camera size={15} strokeWidth={1.5} />)}
                {onShareProject && coverBtn(onShareProject, 'Compartir', <Share size={15} strokeWidth={1.5} />)}
                {onRecord && coverBtn(onRecord, 'Grabar', <Mic size={15} strokeWidth={1.5} />)}
              </div>
            </div>
          </div>

          {/* Project name + play button */}
          <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {project.name}
            </h1>
            <button
              onClick={() => tracks.length > 0 && play(tracks[0], tracks)}
              style={{
                width: 56, height: 56, borderRadius: 16, border: 'none',
                background: 'var(--text-primary)', color: 'var(--bg-primary)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <Play size={22} fill="currentColor" strokeWidth={0} style={{ marginLeft: 3 }} />
            </button>
          </div>

          {/* Meta row */}
          <div style={{ padding: '8px 20px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Lock size={12} strokeWidth={2} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
              {tracks.length} track{tracks.length !== 1 ? 's' : ''}
              {totalSeconds > 0 ? ` · ${fmtTotal(totalSeconds)}` : ''}
            </span>
          </div>

          {/* Add tracks button */}
          <div style={{ padding: '12px 20px 16px' }}>
            <button
              onClick={() => uploadZoneRef.current?.openDialog()}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 14,
                background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer',
                fontSize: 16, fontWeight: 500, fontFamily: 'var(--font-ui)',
                color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Plus size={16} strokeWidth={2.5} />
              Add tracks
            </button>
          </div>

          {/* Upload progress (compact — no visible drop zone, just progress items) */}
          <UploadZone ref={uploadZoneRef} projectId={projectId} folderId={folderId} compact />

          <div style={{ height: 1, background: 'var(--border)', margin: '0 20px' }} />
        </div>
      )}

      {/* ── Track list ── */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>
        {tracks.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}>
            <span style={{ fontSize: 14, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
              No hay canciones todavía
            </span>
          </div>
        )}
        {tracks.map((t, i) => (
          <div key={t.id} className="mv-item-in" style={{ '--i': i }}>
            <TrackRow
              track={t}
              allTracks={tracks}
              isActive={currentTrack?.id === t.id}
              isPlaying={currentTrack?.id === t.id && playing}
              onShare={onShare}
              onNewVersion={setNewVersionTrack}
              onMove={setMoveTrack}
              index={i}
            />
          </div>
        ))}
      </div>

      {newVersionTrack && <NewVersionModal track={newVersionTrack} onClose={() => setNewVersionTrack(null)} />}
      {moveTrack && <MoveTrackModal track={moveTrack} onClose={() => setMoveTrack(null)} />}
    </div>
  )
}
