import { useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { FolderOpen } from 'lucide-react'
import api from '../api/client'

export default function Dashboard() {
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
  })

  if (isLoading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="mv-meta">Loading…</span>
    </div>
  )

  if (projects?.length > 0) return <Navigate to={`/project/${projects[0].id}`} replace />

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40 }}>
      <FolderOpen size={32} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
      <p className="mv-meta">No projects yet. Create one in the sidebar.</p>
    </div>
  )
}
