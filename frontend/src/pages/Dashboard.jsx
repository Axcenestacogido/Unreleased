import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, FolderOpen, LogOut, Music } from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { PlayerProvider } from '../hooks/usePlayer'
import Player from '../components/Player/Player'

function ProjectCard({ project, onClick }) {
  const colors = ['#a855f7', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']
  const color = project.color || colors[project.id % colors.length]

  return (
    <button
      onClick={onClick}
      className="group w-full bg-surface border border-border hover:border-accent/50 rounded-xl p-5 text-left transition-all hover:bg-[#1a1a1a]"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + '22' }}>
          <FolderOpen size={18} style={{ color }} />
        </div>
        <div className="min-w-0">
          <p className="text-white font-medium text-sm truncate">{project.name}</p>
          {project.description && (
            <p className="text-muted text-xs mt-0.5 truncate">{project.description}</p>
          )}
        </div>
      </div>
    </button>
  )
}

export default function Dashboard() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then((r) => r.data),
  })

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me').then((r) => r.data),
  })

  const createProject = useMutation({
    mutationFn: (data) => api.post('/projects', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      setShowNew(false)
      setNewName('')
      setNewDesc('')
    },
  })

  function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    createProject.mutate({ name: newName.trim(), description: newDesc.trim() || null })
  }

  return (
    <PlayerProvider>
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-auto">
          <div className="max-w-2xl mx-auto px-4 pt-10 pb-32">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center">
                  <Music size={16} className="text-accent" />
                </div>
                <div>
                  <h1 className="text-white font-semibold text-lg leading-none">MusicVault</h1>
                  {me && <p className="text-muted text-xs mt-0.5">{me.username}</p>}
                </div>
              </div>
              <button onClick={logout} className="text-muted hover:text-white p-2 rounded-lg transition-colors">
                <LogOut size={16} />
              </button>
            </div>

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-sm font-medium">Projects</h2>
              <button
                onClick={() => setShowNew(true)}
                className="flex items-center gap-1.5 text-accent hover:text-white text-xs font-medium transition-colors"
              >
                <Plus size={14} />
                New project
              </button>
            </div>

            {showNew && (
              <form onSubmit={handleCreate} className="mb-4 bg-surface border border-accent/40 rounded-xl p-4 space-y-2">
                <input
                  autoFocus
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-muted focus:outline-none focus:border-accent"
                  placeholder="Project name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
                <input
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-muted focus:outline-none focus:border-accent"
                  placeholder="Description (optional)"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
                <div className="flex gap-2 pt-1">
                  <button type="submit" className="bg-accent hover:bg-accent-dim text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
                    Create
                  </button>
                  <button type="button" onClick={() => setShowNew(false)} className="text-muted hover:text-white text-xs px-3 py-2 transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {projects.length === 0 && !showNew && (
              <div className="text-center py-16 text-muted">
                <FolderOpen size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No projects yet</p>
                <button onClick={() => setShowNew(true)} className="mt-3 text-accent text-xs hover:underline">
                  Create your first project
                </button>
              </div>
            )}

            <div className="grid gap-2">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} onClick={() => navigate(`/project/${p.id}`)} />
              ))}
            </div>
          </div>
        </div>
        <Player />
      </div>
    </PlayerProvider>
  )
}
