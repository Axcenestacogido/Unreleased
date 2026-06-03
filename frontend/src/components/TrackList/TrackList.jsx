import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Share2, Trash2, History, Upload, FolderInput, Share, BarChart2, Mic, Plus, MoreVertical, Music2, Camera, ChevronLeft } from 'lucide-react'
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
  const [showHistory, setShowHistory] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const current = track.versions?.[track.versions.length - 1]

  // Close menu on outside click
  const menuBtnRef = useRef(null)
  const handleGlobalClick = (e) => {
    if (menuBtnRef.current && !menuBtnRef.current.contains(e.target)) {
      setMenuOpen(false)
      document.removeEventListener('click', handleGlobalClick)
    }
  }

  function openMenu(e) {
    e.stopPropagation()
    setMenuOpen(v => !v)
    if (!menuOpen) {
      setTimeout(() => document.addEventListener('click', handleGlobalClick), 0)
    }
  }

  return (
    <div>
      <div
        onClick={() => play(track, allTracks)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 16px', borderRadius: 'var(--radius-md)',
          cursor: 'pointer', position: 'relative',
          background: isActive ? 'var(--accent-subtle)' : 'transparent',
          transition: `background var(--dur-hover) var(--ease)`,
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-tertiary)' }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
      >
        {/* Active bar */}
        {isActive && (
          <div style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 2, background: 'var(--accent)', borderRadius: 2 }} />
        )}

        {/* Index or equalizer */}
        <div style={{ width: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isActive && isPlaying ? (
            <Equalizer />
          ) : (
            <span className="mv-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1 }}>
              {index + 1}
            </span>
          )}
        </div>

        {/* Title + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="mv-ui" style={{
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontWeight: isActive ? 500 : 400,
            }}>
              {track.name}
            </span>
          </div>
          {current && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span className="mv-meta" style={{ fontSize: 'var(--text-xs)' }}>v{current.version_number}</span>
              <span style={{ color: 'var(--text-muted)' }}>·</span>
              <span className="mv-meta" style={{ fontSize: 'var(--text-xs)' }}>{formatSize(current.file_size)}</span>
              {track.bpm && <><span style={{ color: 'var(--text-muted)' }}>·</span><span className="mv-meta" style={{ fontSize: 'var(--text-xs)' }}>{track.bpm} BPM</span></>}
              {track.key_signature && <><span style={{ color: 'var(--text-muted)' }}>·</span><span className="mv-meta" style={{ fontSize: 'var(--text-xs)' }}>{track.key_signature}</span></>}
              {track.versions?.length > 1 && (
                <>
                  <span style={{ color: 'var(--text-muted)' }}>·</span>
                  <button onClick={e => { e.stopPropagation(); setShowHistory(!showHistory) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-ui)' }}>
                    <History size={10} strokeWidth={1.5} />
                    {track.versions.length}v
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Duration */}
        <span className="mv-mono" style={{ fontSize: 'var(--text-xs)', flexShrink: 0 }}>
          {current?.duration ? fmt(current.duration) : ''}
        </span>

        {/* Date */}
        <span className="mv-meta" style={{ fontSize: 'var(--text-xs)', width: 52, textAlign: 'right', flexShrink: 0 }}>
          {formatDate(track.created_at)}
        </span>

        {/* 3-dots menu button */}
        <div ref={menuBtnRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={openMenu}
            style={{
              width: 28, height: 28, borderRadius: 'var(--radius-sm)', border: 'none',
              background: menuOpen ? 'var(--bg-elevated)' : 'transparent',
              color: 'var(--text-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
            onMouseLeave={e => { if (!menuOpen) e.currentTarget.style.background = 'transparent' }}
          >
            <MoreVertical size={14} strokeWidth={1.5} />
          </button>
          {menuOpen && (
            <TrackMenu
              track={track}
              onShare={onShare}
              onNewVersion={onNewVersion}
              onMove={onMove}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>
      </div>

      {showHistory && (
        <div style={{ margin: '0 16px 8px 46px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          {[...track.versions].reverse().map((v) => (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
              <button
                onClick={e => { e.stopPropagation(); play({ ...track, _playVersion: v.version_number }, allTracks) }}
                style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <div style={{ width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: '7px solid var(--text-primary)', marginLeft: 1 }} />
              </button>
              <span className="mv-mono" style={{ fontSize: 'var(--text-xs)' }}>v{v.version_number}</span>
              {v.note && <span className="mv-meta" style={{ fontSize: 'var(--text-xs)' }}>— {v.note}</span>}
              <div style={{ flex: 1 }} />
              <span className="mv-meta" style={{ fontSize: 'var(--text-xs)' }}>{new Date(v.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
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

export default function TrackList({ projectId, folderId, project, onShare, onShareProject, onRecord, onAnalytics }) {
  const { currentTrack } = usePlayer()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [newVersionTrack, setNewVersionTrack] = useState(null)
  const [moveTrack, setMoveTrack] = useState(null)
  const coverInputRef = useRef()

  const { data: tracks = [] } = useQuery({
    queryKey: ['tracks', projectId, folderId],
    queryFn: () => api.get(`/tracks/project/${projectId}`, { params: folderId != null ? { folder_id: folderId } : {} }).then(r => r.data),
    enabled: !!projectId,
  })

  const updatedDate = tracks.length > 0
    ? formatDate(tracks.reduce((a, b) => new Date(a.updated_at || a.created_at) > new Date(b.updated_at || b.created_at) ? a : b).updated_at || tracks[0].created_at)
    : null

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

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Sticky project header */}
      {project && (
        <div style={{
          flexShrink: 0, background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border)',
        }}>
          {/* Cover art section */}
          <div style={{
            width: '100%', height: 180,
            background: project.cover_image ? undefined : grad,
            position: 'relative', overflow: 'hidden',
            display: 'flex', alignItems: 'flex-end',
          }}>
            {project.cover_image && (
              <img src={project.cover_image} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
            {/* Gradient overlay */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }} />

            {/* Back button */}
            <button
              onClick={() => navigate('/')}
              title="Volver"
              style={{
                position: 'absolute', top: 12, left: 12,
                width: 32, height: 32, borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(0,0,0,0.45)',
                color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(4px)',
              }}
            >
              <ChevronLeft size={18} strokeWidth={2} />
            </button>

            {/* Project info over image */}
            <div style={{ position: 'relative', padding: '0 28px 16px', flex: 1, minWidth: 0 }}>
              <h1 className="mv-h1" style={{ color: '#fff', marginBottom: 4, fontSize: 'var(--text-xl)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {project.name}
              </h1>
              <span style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-ui)' }}>
                {tracks.length} track{tracks.length !== 1 ? 's' : ''}
                {updatedDate ? ` · ${updatedDate}` : ''}
              </span>
            </div>

            {/* Action buttons */}
            <div style={{ position: 'relative', padding: '0 16px 16px', display: 'flex', gap: 6, flexShrink: 0 }}>
              {/* Upload cover */}
              <input ref={coverInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverUpload} />
              <button
                onClick={() => coverInputRef.current?.click()}
                title="Cambiar portada"
                style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.4)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                <Camera size={13} strokeWidth={1.5} />
              </button>
              {onRecord && (
                <button onClick={onRecord} title="Grabar" style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.4)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                  <Mic size={13} strokeWidth={1.5} />
                </button>
              )}
              {onShareProject && (
                <button onClick={onShareProject} title="Compartir proyecto" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px', height: 32, borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.4)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 'var(--text-xs)', fontWeight: 500, backdropFilter: 'blur(4px)' }}>
                  <Share size={12} strokeWidth={1.5} />
                  Compartir
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload zone */}
      <UploadZone projectId={projectId} folderId={folderId} />

      {/* Tracks list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 24px' }}>
        {tracks.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}>
            <span className="mv-meta" style={{ color: 'var(--text-muted)' }}>Sin canciones — arrastra archivos arriba</span>
          </div>
        ) : (
          tracks.map((t, i) => (
            <TrackRow
              key={t.id}
              track={t}
              allTracks={tracks}
              isActive={currentTrack?.id === t.id}
              isPlaying={currentTrack?.id === t.id}
              onShare={onShare}
              onNewVersion={setNewVersionTrack}
              onMove={setMoveTrack}
              index={i}
            />
          ))
        )}

        {/* Ghost add row */}
        <label
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 16px', borderRadius: 'var(--radius-md)',
            cursor: 'pointer', marginTop: 4,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <input type="file" accept="audio/*" multiple style={{ display: 'none' }}
            onChange={e => {
              // handled by UploadZone but this is a secondary trigger
            }}
          />
          <Plus size={14} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)', color: 'var(--text-muted)' }}>
            Añadir canciones
          </span>
        </label>
      </div>

      {newVersionTrack && (
        <NewVersionModal track={newVersionTrack} onClose={() => setNewVersionTrack(null)} />
      )}
      {moveTrack && (
        <MoveTrackModal track={moveTrack} onClose={() => setMoveTrack(null)} />
      )}
    </div>
  )
}
