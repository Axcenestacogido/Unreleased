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
    queryFn: () => api.get('/projects').then((r) => r.data),
  })

  const { data: folders = [] } = useQuery({
    queryKey: ['folders', targetProjectId],
    queryFn: () => api.get(`/projects/${targetProjectId}/folders`).then((r) => r.data),
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

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-medium text-sm">Move — {track.name}</h3>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-muted text-xs block mb-1.5">Project</label>
            <select
              className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
              value={targetProjectId}
              onChange={(e) => { setTargetProjectId(e.target.value); setTargetFolderId('') }}
            >
              {projects.map((p) => (
                <option key={p.id} value={String(p.id)}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-muted text-xs block mb-1.5">Folder (optional)</label>
            <select
              className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
              value={targetFolderId}
              onChange={(e) => setTargetFolderId(e.target.value)}
            >
              <option value="">No folder</option>
              {folders.map((f) => (
                <option key={f.id} value={String(f.id)}>{f.name}</option>
              ))}
            </select>
          </div>

          {move.isError && <p className="text-red-400 text-xs">Move failed</p>}

          <button
            onClick={() => move.mutate()}
            disabled={isSameLocation || move.isPending}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-dim disabled:opacity-40 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            <ArrowRight size={14} /> Move here
          </button>
        </div>
      </div>
    </div>
  )
}
