import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, ArrowRight } from 'lucide-react'
import api from '../../api/client'

export default function MoveTrackModal({ track, onClose }) {
  const qc = useQueryClient()
  const [targetProjectId, setTargetProjectId] = useState(String(track.project_id))
  const [targetFolderId, setTargetFolderId] = useState('')

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
  })

  const { data: folders = [] } = useQuery({
    queryKey: ['folders', targetProjectId],
    queryFn: () => api.get(`/projects/${targetProjectId}/folders`).then(r => r.data),
    enabled: !!targetProjectId,
  })

  const move = useMutation({
    mutationFn: () => {
      const payload = {
        project_id: parseInt(targetProjectId),
        folder_id: targetFolderId ? parseInt(targetFolderId) : null,
      }
      return api.patch(`/tracks/${track.id}`, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tracks'] })
      onClose()
    },
  })

  const isSameLocation =
    String(track.project_id) === targetProjectId &&
    (targetFolderId === '' ? track.folder_id === null : String(track.folder_id) === targetFolderId)

  const selectStyle = {
    width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', padding: '8px 12px',
    fontSize: 'var(--text-sm)', color: 'var(--text-primary)', outline: 'none',
    fontFamily: 'var(--font-ui)', cursor: 'pointer',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-xl)', padding: 24, width: '100%', maxWidth: 340, boxShadow: 'var(--shadow-modal)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 className="mv-ui" style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>Move — {track.name}</h3>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, lineHeight: 0, borderRadius: 'var(--radius-sm)' }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="mv-label" style={{ display: 'block', marginBottom: 6 }}>Project</label>
            <select
              style={selectStyle}
              value={targetProjectId}
              onChange={e => { setTargetProjectId(e.target.value); setTargetFolderId('') }}
            >
              {projects.map(p => (
                <option key={p.id} value={String(p.id)}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mv-label" style={{ display: 'block', marginBottom: 6 }}>Folder (optional)</label>
            <select
              style={selectStyle}
              value={targetFolderId}
              onChange={e => setTargetFolderId(e.target.value)}
            >
              <option value="">No folder</option>
              {folders.map(f => (
                <option key={f.id} value={String(f.id)}>{f.name}</option>
              ))}
            </select>
          </div>

          {move.isError && <p style={{ color: '#f87171', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-ui)' }}>Move failed</p>}

          <button
            onClick={() => move.mutate()}
            disabled={isSameLocation || move.isPending}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: 'var(--accent)', color: '#000', border: 'none',
              borderRadius: 'var(--radius-md)', padding: '9px 12px',
              fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-ui)',
              cursor: isSameLocation || move.isPending ? 'not-allowed' : 'pointer',
              opacity: isSameLocation || move.isPending ? 0.4 : 1,
            }}
          >
            <ArrowRight size={14} strokeWidth={1.5} /> Move here
          </button>
        </div>
      </div>
    </div>
  )
}
