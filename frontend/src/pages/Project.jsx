import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Upload, FolderPlus, MoreHorizontal, Share2, Trash2, History } from 'lucide-react'
import api from '../api/client'
import { PlayerProvider } from '../hooks/usePlayer'
import Player from '../components/Player/Player'
import TrackList from '../components/TrackList/TrackList'
import ShareModal from '../components/ShareModal/ShareModal'
import UploadZone from '../components/TrackList/UploadZone'

export default function Project() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [shareTrack, setShareTrack] = useState(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get(`/projects/${id}`).then((r) => r.data),
  })

  const { data: folders = [] } = useQuery({
    queryKey: ['folders', id],
    queryFn: () => api.get(`/projects/${id}/folders`).then((r) => r.data),
  })

  const createFolder = useMutation({
    mutationFn: (name) => api.post(`/projects/${id}/folders`, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders', id] })
      setShowNewFolder(false)
      setNewFolderName('')
    },
  })

  const deleteFolder = useMutation({
    mutationFn: (fid) => api.delete(`/projects/${id}/folders/${fid}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders', id] })
      qc.invalidateQueries({ queryKey: ['tracks', id] })
      if (selectedFolder === fid) setSelectedFolder(null)
    },
  })

  const handleFolderCreate = (e) => {
    e.preventDefault()
    if (!newFolderName.trim()) return
    createFolder.mutate(newFolderName.trim())
  }

  return (
    <PlayerProvider>
      <div className="h-full flex flex-col bg-bg">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-6 pb-4 border-b border-border">
          <button onClick={() => navigate('/')} className="text-muted hover:text-white p-1.5 rounded-lg transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-white font-semibold text-base flex-1 truncate">
            {project?.name || '…'}
          </h1>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-48 flex-shrink-0 border-r border-border overflow-y-auto py-3 px-2">
            <button
              onClick={() => setSelectedFolder(null)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors mb-1 ${
                selectedFolder === null ? 'bg-accent/15 text-accent' : 'text-muted hover:text-white hover:bg-surface'
              }`}
            >
              All tracks
            </button>

            <div className="mt-2 mb-1">
              <div className="flex items-center justify-between px-3 py-1">
                <span className="text-[10px] uppercase tracking-wider text-muted font-medium">Folders</span>
                <button onClick={() => setShowNewFolder(true)} className="text-muted hover:text-white transition-colors">
                  <FolderPlus size={12} />
                </button>
              </div>

              {showNewFolder && (
                <form onSubmit={handleFolderCreate} className="px-2 mt-1">
                  <input
                    autoFocus
                    className="w-full bg-surface border border-accent/40 rounded px-2 py-1.5 text-xs text-white focus:outline-none"
                    placeholder="Folder name"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onBlur={() => !newFolderName && setShowNewFolder(false)}
                  />
                </form>
              )}

              {folders.map((f) => (
                <div key={f.id} className="group flex items-center">
                  <button
                    onClick={() => setSelectedFolder(f.id)}
                    className={`flex-1 text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                      selectedFolder === f.id ? 'bg-accent/15 text-accent' : 'text-muted hover:text-white hover:bg-surface'
                    }`}
                  >
                    {f.name}
                  </button>
                  <button
                    onClick={() => deleteFolder.mutate(f.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-red-400 transition-all"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-hidden flex flex-col">
            <UploadZone projectId={id} folderId={selectedFolder} />
            <TrackList
              projectId={id}
              folderId={selectedFolder}
              onShare={setShareTrack}
            />
          </main>
        </div>

        <Player />

        {shareTrack && (
          <ShareModal track={shareTrack} onClose={() => setShareTrack(null)} />
        )}
      </div>
    </PlayerProvider>
  )
}
