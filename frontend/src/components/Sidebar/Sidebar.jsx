import { useState, useEffect } from 'react'
import { useNavigate, useMatch } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Disc3, Folder, FolderPlus, Trash2, LogOut, Sun, Moon } from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../hooks/useAuth'
import { useSSEStatus } from '../../hooks/useSSE'

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('mv-theme') || 'dark')
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('mv-theme', theme)
  }, [theme])
  return [theme, setTheme]
}

function NavItem({ icon: Icon, label, active, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '8px 10px', borderRadius: 'var(--radius-md)', border: 'none',
        cursor: 'pointer', textAlign: 'left',
        fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)',
        fontWeight: active ? 500 : 400, letterSpacing: 'var(--tracking-ui)',
        background: active || hover ? 'var(--accent-subtle)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        transition: `all var(--dur-hover) var(--ease)`,
      }}>
      <Icon size={16} strokeWidth={1.5} />
      <span>{label}</span>
    </button>
  )
}

function SidebarSection({ label, children, action }) {
  return (
    <div style={{ padding: '14px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', marginBottom: 6 }}>
        <span className="mv-label">{label}</span>
        {action}
      </div>
      {children}
    </div>
  )
}

export default function Sidebar() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { connected } = useSSEStatus()
  const qc = useQueryClient()
  const matchProj = useMatch('/project/:id')
  const activeProjectId = matchProj?.params?.id
  const [theme, setTheme] = useTheme()

  const [newProjName, setNewProjName] = useState('')
  const [showNewProj, setShowNewProj] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
  })

  const { data: folders = [] } = useQuery({
    queryKey: ['folders', activeProjectId],
    queryFn: () => api.get(`/projects/${activeProjectId}/folders`).then(r => r.data),
    enabled: !!activeProjectId,
  })

  const createProject = useMutation({
    mutationFn: name => api.post('/projects', { name }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      setShowNewProj(false)
      setNewProjName('')
      navigate(`/project/${res.data.id}`)
    },
  })

  const deleteProject = useMutation({
    mutationFn: id => api.delete(`/projects/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); navigate('/') },
  })

  const createFolder = useMutation({
    mutationFn: name => api.post(`/projects/${activeProjectId}/folders`, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders', activeProjectId] })
      setShowNewFolder(false)
      setNewFolderName('')
    },
  })

  return (
    <aside className="mv-sidebar" style={{
      width: 'var(--col-sidebar)', flexShrink: 0, background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
      padding: '0 12px', overflowY: 'auto',
    }}>
      {/* Wordmark */}
      <div style={{ padding: '20px 10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          onClick={() => navigate('/')}
          style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 600, letterSpacing: 'var(--tracking-display)', color: 'var(--text-primary)', cursor: 'pointer' }}>
          MusicVault
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 'var(--radius-sm)', lineHeight: 0 }}>
            {theme === 'dark' ? <Sun size={13} strokeWidth={1.5} /> : <Moon size={13} strokeWidth={1.5} />}
          </button>
          <button onClick={logout} title="Sign out" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 'var(--radius-sm)', lineHeight: 0 }}>
            <LogOut size={13} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Projects */}
      <SidebarSection label="Projects" action={
        <button onClick={() => setShowNewProj(v => !v)} title="New project"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, lineHeight: 0, borderRadius: 'var(--radius-sm)' }}>
          <Plus size={13} strokeWidth={1.5} />
        </button>
      }>
        {showNewProj && (
          <form onSubmit={e => { e.preventDefault(); if (newProjName.trim()) createProject.mutate(newProjName.trim()) }}
            style={{ padding: '0 10px', marginBottom: 6 }}>
            <input
              autoFocus value={newProjName} onChange={e => setNewProjName(e.target.value)}
              placeholder="Project name"
              onBlur={() => !newProjName && setShowNewProj(false)}
              style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', padding: '6px 8px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-ui)' }}
            />
          </form>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {projects.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}
              onMouseEnter={e => { const btn = e.currentTarget.querySelector('[data-del]'); if (btn) btn.style.opacity = '1' }}
              onMouseLeave={e => { const btn = e.currentTarget.querySelector('[data-del]'); if (btn) btn.style.opacity = '0' }}>
              <NavItem icon={Disc3} label={p.name} active={activeProjectId === String(p.id)} onClick={() => navigate(`/project/${p.id}`)} />
              {activeProjectId === String(p.id) && (
                <button data-del
                  onClick={() => window.confirm(`Delete "${p.name}"?`) && deleteProject.mutate(p.id)}
                  style={{ position: 'absolute', right: 4, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, lineHeight: 0, borderRadius: 'var(--radius-sm)', opacity: 0, transition: 'opacity 120ms' }}
                  title="Delete project">
                  <Trash2 size={11} strokeWidth={1.5} />
                </button>
              )}
            </div>
          ))}
        </div>
      </SidebarSection>

      {/* Folders (only for active project) */}
      {activeProjectId && (
        <SidebarSection label="Folders" action={
          <button onClick={() => setShowNewFolder(v => !v)} title="New folder"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, lineHeight: 0, borderRadius: 'var(--radius-sm)' }}>
            <FolderPlus size={13} strokeWidth={1.5} />
          </button>
        }>
          {showNewFolder && (
            <form onSubmit={e => { e.preventDefault(); if (newFolderName.trim()) createFolder.mutate(newFolderName.trim()) }}
              style={{ padding: '0 10px', marginBottom: 6 }}>
              <input
                autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                onBlur={() => !newFolderName && setShowNewFolder(false)}
                style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', padding: '6px 8px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-ui)' }}
              />
            </form>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {folders.map(f => (
              <NavItem key={f.id} icon={Folder} label={f.name} active={false} onClick={() => {}} />
            ))}
          </div>
        </SidebarSection>
      )}

      <div style={{ flex: 1 }} />

      {/* Status footer */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: connected ? '#4ade80' : '#666', transition: 'background 0.3s' }} />
        <span className="mv-meta" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          {connected ? 'Live' : 'Connecting…'}
        </span>
      </div>
    </aside>
  )
}
