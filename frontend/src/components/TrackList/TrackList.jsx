import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Play, Share2, Trash2, History, MoreHorizontal, Upload } from 'lucide-react'
import api from '../../api/client'
import { usePlayer } from '../../hooks/usePlayer'

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function TrackRow({ track, allTracks, onShare, onNewVersion }) {
  const { play } = usePlayer()
  const qc = useQueryClient()
  const [showHistory, setShowHistory] = useState(false)
  const current = track.versions?.[track.versions.length - 1]

  const deleteTrack = useMutation({
    mutationFn: () => api.delete(`/tracks/${track.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tracks', String(track.project_id)] }),
  })

  return (
    <div className="group">
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-surface/50 rounded-xl transition-colors">
        <button
          onClick={() => play(track, allTracks)}
          className="w-8 h-8 rounded-full bg-surface border border-border hover:border-accent/50 hover:bg-accent/10 flex items-center justify-center flex-shrink-0 transition-colors"
        >
          <Play size={12} className="text-accent ml-0.5" />
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate">{track.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {current && (
              <>
                <span className="text-muted text-xs">v{current.version_number}</span>
                <span className="text-border">·</span>
                <span className="text-muted text-xs">{formatSize(current.file_size)}</span>
              </>
            )}
            {track.versions?.length > 1 && (
              <>
                <span className="text-border">·</span>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-muted hover:text-accent text-xs transition-colors flex items-center gap-0.5"
                >
                  <History size={10} />
                  {track.versions.length} versions
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onNewVersion(track)}
            className="p-1.5 text-muted hover:text-white rounded-lg hover:bg-surface transition-colors"
            title="Upload new version"
          >
            <Upload size={13} />
          </button>
          <button
            onClick={() => onShare(track)}
            className="p-1.5 text-muted hover:text-white rounded-lg hover:bg-surface transition-colors"
            title="Share"
          >
            <Share2 size={13} />
          </button>
          <button
            onClick={() => confirm('Delete this track?') && deleteTrack.mutate()}
            className="p-1.5 text-muted hover:text-red-400 rounded-lg hover:bg-surface transition-colors"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {showHistory && (
        <div className="mx-4 mb-2 bg-surface border border-border rounded-xl divide-y divide-border">
          {[...track.versions].reverse().map((v) => (
            <div key={v.id} className="flex items-center gap-3 px-4 py-2.5">
              <button
                onClick={() => play({ ...track, _playVersion: v.version_number }, allTracks)}
                className="w-6 h-6 rounded-full bg-bg border border-border hover:border-accent/50 flex items-center justify-center flex-shrink-0"
              >
                <Play size={9} className="text-accent ml-px" />
              </button>
              <div className="flex-1 min-w-0">
                <span className="text-white text-xs">v{v.version_number}</span>
                {v.note && <span className="text-muted text-xs ml-2">— {v.note}</span>}
              </div>
              <span className="text-muted text-[10px]">{new Date(v.created_at).toLocaleDateString()}</span>
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-white font-medium mb-4">New version — {track.name}</h3>
        <label className="block border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-accent/50 transition-colors">
          <input
            type="file"
            accept="audio/*,.mp3,.wav,.flac,.aac,.ogg,.m4a"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files[0]
              if (file) upload.mutate({ file, note })
            }}
          />
          <Upload size={18} className="mx-auto text-muted mb-2" />
          <p className="text-muted text-sm">Choose audio file</p>
        </label>
        <input
          className="mt-3 w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-muted focus:outline-none focus:border-accent"
          placeholder="Version note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {upload.isError && <p className="text-red-400 text-xs mt-2">Upload failed</p>}
        <button onClick={onClose} className="mt-3 w-full text-muted text-xs hover:text-white transition-colors py-2">
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function TrackList({ projectId, folderId, onShare }) {
  const [newVersionTrack, setNewVersionTrack] = useState(null)

  const { data: tracks = [] } = useQuery({
    queryKey: ['tracks', projectId, folderId],
    queryFn: () => api.get(`/tracks/project/${projectId}`, { params: folderId != null ? { folder_id: folderId } : {} }).then((r) => r.data),
  })

  if (tracks.length === 0) return (
    <div className="flex-1 flex items-center justify-center text-muted">
      <p className="text-sm">No tracks yet — drop some audio above</p>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto px-2 py-3 pb-24">
      {tracks.map((t) => (
        <TrackRow
          key={t.id}
          track={t}
          allTracks={tracks}
          onShare={onShare}
          onNewVersion={setNewVersionTrack}
        />
      ))}
      {newVersionTrack && (
        <NewVersionModal track={newVersionTrack} onClose={() => setNewVersionTrack(null)} />
      )}
    </div>
  )
}
