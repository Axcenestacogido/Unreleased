import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Play, Pause, Share2, Trash2, History, Upload, FolderInput, Plus, Mic, Share, BarChart2 } from 'lucide-react'
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

function TrackRow({ track, allTracks, isActive, isPlaying, onShare, onNewVersion, onMove, index }) {
  const { play } = usePlayer()
  const qc = useQueryClient()
  const [showHistory, setShowHistory] = useState(false)
  const [hover, setHover] = useState(false)
  const current = track.versions?.[track.versions.length - 1]

  const deleteTrack = useMutation({
    mutationFn: () => api.delete(`/tracks/${track.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tracks', String(track.project_id)] }),
  })

  return (
    <div>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 16px', borderRadius: 'var(--radius-md)',
          background: hover ? 'var(--bg-tertiary)' : 'transparent',
          position: 'relative', cursor: 'default',
          transition: `background var(--dur-hover) var(--ease)`,
        }}
      >
        {/* Active bar */}
        {isActive && (
          <div style={{
            position: 'absolute', left: 0, top: 8, bottom: 8, width: 2,
            background: 'var(--accent)', borderRadius: 2,
          }} />
        )}

        {/* Index / play button */}
        <div
          onClick={() => play(track, allTracks)}
          style={{
            width: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {hover || isActive ? (
            isActive && isPlaying
              ? <Pause size={13} strokeWidth={1.5} style={{ color: 'var(--text-primary)' }} />
              : <Play size={13} strokeWidth={1.5} style={{ color: 'var(--text-primary)', marginLeft: 1 }} />
          ) : (
            <span className="mv-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1 }}>
              {index + 1}
            </span>
          )}
        </div>

        {/* Title + artist */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              className="mv-ui"
              style={{
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: isActive ? 'var(--text-primary)' : 'var(--text-primary)',
                fontWeight: isActive ? 500 : 400,
              }}
            >
              {track.name}
            </span>
            {isActive && isPlaying && <Equalizer />}
          </div>
          {current && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span className="mv-meta" style={{ fontSize: 'var(--text-xs)' }}>v{current.version_number}</span>
              <span style={{ color: 'var(--text-muted)' }}>·</span>
              <span className="mv-meta" style={{ fontSize: 'var(--text-xs)' }}>{formatSize(current.file_size)}</span>
              {track.versions?.length > 1 && (
                <>
                  <span style={{ color: 'var(--text-muted)' }}>·</span>
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-ui)' }}
                  >
                    <History size={10} strokeWidth={1.5} />
                    {track.versions.length} versions
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Duration */}
        <span className="mv-mono" style={{ fontSize: 'var(--text-xs)', flexShrink: 0 }}>
          {current?.duration_secs ? fmt(current.duration_secs) : ''}
        </span>

        {/* Date */}
        <span className="mv-meta" style={{ fontSize: 'var(--text-xs)', width: 64, textAlign: 'right', flexShrink: 0 }}>
          {formatDate(track.created_at)}
        </span>

        {/* Actions (hover) */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 2,
          opacity: hover ? 1 : 0, transition: `opacity var(--dur-hover) var(--ease)`,
        }}>
          <ActionBtn onClick={() => onNewVersion(track)} title="Upload new version">
            <Upload size={12} strokeWidth={1.5} />
          </ActionBtn>
          <ActionBtn onClick={() => onMove(track)} title="Move to…">
            <FolderInput size={12} strokeWidth={1.5} />
          </ActionBtn>
          <ActionBtn onClick={() => onShare(track)} title="Share">
            <Share2 size={12} strokeWidth={1.5} />
          </ActionBtn>
          <ActionBtn onClick={() => window.confirm('Delete this track?') && deleteTrack.mutate()} title="Delete" danger>
            <Trash2 size={12} strokeWidth={1.5} />
          </ActionBtn>
        </div>
      </div>

      {showHistory && (
        <div style={{
          margin: '0 16px 8px 46px', background: 'var(--bg-secondary)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden',
        }}>
          {[...track.versions].reverse().map((v) => (
            <div key={v.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              borderBottom: '1px solid var(--border)',
            }}>
              <button
                onClick={() => play({ ...track, _playVersion: v.version_number }, allTracks)}
                style={{
                  width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                <Play size={9} strokeWidth={1.5} style={{ color: 'var(--text-primary)', marginLeft: 1 }} />
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

function ActionBtn({ onClick, children, title, danger }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 26, height: 26, borderRadius: 'var(--radius-sm)', border: 'none',
        background: hover ? 'var(--bg-elevated)' : 'transparent',
        color: hover && danger ? '#f87171' : hover ? 'var(--text-primary)' : 'var(--text-muted)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: `all var(--dur-hover) var(--ease)`,
      }}
    >
      {children}
    </button>
  )
}

function fmt(s) {
  if (!s || isNaN(s)) return ''
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tracks', String(track.project_id)] })
      onClose()
    },
  })

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-xl)', padding: 24, width: '100%', maxWidth: 360, boxShadow: 'var(--shadow-modal)' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="mv-ui" style={{ fontWeight: 500, marginBottom: 16 }}>New version — {track.name}</h3>
        <label
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            display: 'block', border: `1.5px dashed ${hover ? 'var(--border-strong)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-lg)', padding: '20px 16px', textAlign: 'center',
            cursor: 'pointer', transition: `border-color var(--dur-hover) var(--ease)`,
          }}
        >
          <input
            type="file" accept="audio/*,.mp3,.wav,.flac,.aac,.ogg,.m4a"
            style={{ display: 'none' }}
            onChange={e => { const file = e.target.files[0]; if (file) upload.mutate({ file, note }) }}
          />
          <Upload size={18} style={{ margin: '0 auto 8px', color: 'var(--text-muted)', display: 'block' }} strokeWidth={1.5} />
          <p className="mv-meta" style={{ fontSize: 'var(--text-xs)' }}>Choose audio file</p>
        </label>
        <input
          style={{
            marginTop: 10, width: '100%', background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            padding: '8px 12px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)',
            outline: 'none', fontFamily: 'var(--font-ui)',
          }}
          placeholder="Version note (optional)"
          value={note}
          onChange={e => setNote(e.target.value)}
        />
        {upload.isError && <p style={{ color: '#f87171', fontSize: 'var(--text-xs)', marginTop: 8 }}>Upload failed</p>}
        <button
          onClick={onClose}
          style={{ marginTop: 10, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-ui)' }}
        >Cancel</button>
      </div>
    </div>
  )
}

export default function TrackList({ projectId, folderId, project, onShare, onShareProject, onRecord, onAnalytics }) {
  const { currentTrack } = usePlayer()
  const [newVersionTrack, setNewVersionTrack] = useState(null)
  const [moveTrack, setMoveTrack] = useState(null)

  const { data: tracks = [] } = useQuery({
    queryKey: ['tracks', projectId, folderId],
    queryFn: () => api.get(`/tracks/project/${projectId}`, { params: folderId != null ? { folder_id: folderId } : {} }).then(r => r.data),
    enabled: !!projectId,
  })

  const updatedDate = tracks.length > 0
    ? formatDate(tracks.reduce((a, b) => new Date(a.updated_at || a.created_at) > new Date(b.updated_at || b.created_at) ? a : b).updated_at || tracks[0].created_at)
    : null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Project header */}
      {project && (
        <div style={{ padding: '28px 28px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              <span className="mv-label" style={{ display: 'block', marginBottom: 6 }}>PROJECT</span>
              <h1 className="mv-h1" style={{ marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {project.name}
              </h1>
              <span className="mv-meta">
                {tracks.length} track{tracks.length !== 1 ? 's' : ''}
                {updatedDate ? ` · updated ${updatedDate}` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
              {onRecord && (
                <HeaderBtn onClick={onRecord} title="Record idea">
                  <Mic size={14} strokeWidth={1.5} />
                </HeaderBtn>
              )}
              {onAnalytics && (
                <HeaderBtn onClick={onAnalytics} title="Analytics">
                  <BarChart2 size={14} strokeWidth={1.5} />
                </HeaderBtn>
              )}
              {onShareProject && (
                <button
                  onClick={onShareProject}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                    borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)',
                    background: 'transparent', color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', cursor: 'pointer',
                    transition: `all var(--dur-hover) var(--ease)`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-tertiary)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent' }}
                >
                  <Share size={13} strokeWidth={1.5} />
                  Share
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload zone */}
      <UploadZone projectId={projectId} folderId={folderId} />

      {/* Tracks */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 24px' }}>
        {tracks.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}>
            <span className="mv-meta" style={{ color: 'var(--text-muted)' }}>No tracks yet — drop some audio above</span>
          </div>
        ) : (
          tracks.map((t, i) => (
            <TrackRow
              key={t.id}
              track={t}
              allTracks={tracks}
              isActive={currentTrack?.id === t.id}
              isPlaying={false}
              onShare={onShare}
              onNewVersion={setNewVersionTrack}
              onMove={setMoveTrack}
              index={i}
            />
          ))
        )}

        {/* Ghost add row */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 16px', borderRadius: 'var(--radius-md)',
            cursor: 'pointer', marginTop: 4,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.querySelector('span').style.color = 'var(--text-secondary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.querySelector('span').style.color = 'var(--text-muted)' }}
        >
          <Plus size={14} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)', color: 'var(--text-muted)', transition: `color var(--dur-hover) var(--ease)` }}>
            Add tracks
          </span>
        </div>
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

function HeaderBtn({ onClick, children, title }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 32, height: 32, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
        background: hover ? 'var(--bg-tertiary)' : 'transparent',
        color: hover ? 'var(--text-primary)' : 'var(--text-muted)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: `all var(--dur-hover) var(--ease)`,
      }}
    >
      {children}
    </button>
  )
}
