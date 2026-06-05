import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Disc3, FolderPlus, Upload, X, Music2 } from 'lucide-react'
import api from '../api/client'
import { usePlayer } from '../hooks/usePlayer'

function ProjectCard({ project, onClick }) {
  const [hover, setHover] = useState(false)
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
  const grad = gradients[project.id % gradients.length]

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        cursor: 'pointer',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        background: 'var(--bg-secondary)',
        border: `1px solid ${hover ? 'var(--border-strong)' : 'var(--border)'}`,
        transition: `all var(--dur-hover) var(--ease)`,
        transform: hover ? 'scale(1.01)' : 'scale(1)',
      }}
    >
      {/* Cover */}
      <div style={{
        width: '100%', aspectRatio: '1',
        background: project.cover_image ? undefined : grad,
        position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {project.cover_image
          ? <img src={project.cover_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Music2 size={32} strokeWidth={1} style={{ color: 'rgba(255,255,255,0.4)' }} />
        }
        {/* Play overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hover ? 1 : 0, transition: `opacity var(--dur-hover) var(--ease)`,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: 0, height: 0, borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderLeft: '14px solid #111', marginLeft: 2 }} />
          </div>
        </div>
      </div>
      {/* Info */}
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', fontWeight: 500,
          color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          marginBottom: 2,
        }}>
          {project.name}
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
          Private
        </div>
      </div>
    </div>
  )
}

function AddModal({ onClose }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [mode, setMode] = useState(null) // 'project' | 'folder' | 'import'
  const [name, setName] = useState('')
  const fileRef = useRef()

  const createProject = useMutation({
    mutationFn: n => api.post('/projects', { name: n }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      navigate(`/project/${res.data.id}`)
      onClose()
    },
  })

  const options = [
    { key: 'project', icon: <Disc3 size={20} strokeWidth={1.5} />, label: 'Crear proyecto', desc: 'Un nuevo proyecto vacío' },
    { key: 'import', icon: <Upload size={20} strokeWidth={1.5} />, label: 'Importar canción', desc: 'Sube un archivo de audio' },
    { key: 'folder', icon: <FolderPlus size={20} strokeWidth={1.5} />, label: 'Crear carpeta', desc: 'Dentro del proyecto activo' },
  ]

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200, padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-xl)', padding: 20, width: '100%', maxWidth: 400, boxShadow: 'var(--shadow-modal)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
            {mode ? (mode === 'project' ? 'Nuevo proyecto' : mode === 'folder' ? 'Nueva carpeta' : 'Importar') : 'Añadir'}
          </span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 0 }}>
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {!mode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {options.map(o => (
              <button key={o.key} onClick={() => setMode(o.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                  borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
                  background: 'var(--bg-tertiary)', cursor: 'pointer',
                  color: 'var(--text-primary)', textAlign: 'left',
                  transition: `all var(--dur-hover) var(--ease)`,
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-strong)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <span style={{ color: 'var(--text-secondary)' }}>{o.icon}</span>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 2 }}>{o.label}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{o.desc}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (mode === 'project' || mode === 'folder') ? (
          <form onSubmit={e => { e.preventDefault(); if (name.trim()) createProject.mutate(name.trim()) }}>
            <input
              autoFocus value={name} onChange={e => setName(e.target.value)}
              placeholder={mode === 'project' ? 'Nombre del proyecto' : 'Nombre de la carpeta'}
              style={{
                width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: 'var(--text-sm)',
                color: 'var(--text-primary)', outline: 'none', marginBottom: 10,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setMode(null)} style={{ flex: 1, padding: '9px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>Atrás</button>
              <button type="submit" disabled={!name.trim()} style={{ flex: 2, padding: '9px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--accent)', color: 'var(--bg-primary)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 500 }}>Crear</button>
            </div>
          </form>
        ) : (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <p className="mv-meta" style={{ marginBottom: 12 }}>Para importar una canción, abre un proyecto primero y arrastra el archivo ahí.</p>
            <button onClick={() => setMode(null)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 16px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>Atrás</button>
          </div>
        )}
      </div>
    </div>
  )
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mobile
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState(false)
  const { currentTrack } = usePlayer()
  const isMobile = useIsMobile()

  // The mini player's "+" button fires this event
  useEffect(() => {
    const handler = () => setShowAdd(true)
    window.addEventListener('mini-player-add', handler)
    return () => window.removeEventListener('mini-player-add', handler)
  }, [])

  const hasMiniPlayer = isMobile && !!currentTrack

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
  })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)', position: 'relative' }}>
      {/* Sticky header */}
      <div style={{
        padding: '24px 28px 16px', flexShrink: 0,
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-primary)',
      }}>
        <h1 className="mv-h1" style={{ fontSize: 'var(--text-xl)' }}>Proyectos</h1>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: `20px 24px ${hasMiniPlayer ? '170px' : '100px'}` }}>
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}>
            <span className="mv-meta">Cargando…</span>
          </div>
        ) : projects.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12 }}>
            <Disc3 size={32} strokeWidth={1} style={{ color: 'var(--text-muted)' }} />
            <p className="mv-meta" style={{ textAlign: 'center' }}>No hay proyectos aún.<br />Pulsa + para crear uno.</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 16,
          }}>
            {projects.map(p => (
              <ProjectCard key={p.id} project={p} onClick={() => navigate(`/project/${p.id}`)} />
            ))}
          </div>
        )}
      </div>

      {/* + Add button — centered when no mini player, corner FAB when mini player is showing */}
      <div style={{
        position: 'fixed',
        bottom: hasMiniPlayer ? 94 : 28,
        right: hasMiniPlayer ? 18 : undefined,
        left: hasMiniPlayer ? undefined : '50%',
        transform: hasMiniPlayer ? undefined : 'translateX(-50%)',
        zIndex: 20,
        transition: 'bottom 0.25s ease, right 0.25s ease',
      }}>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: hasMiniPlayer ? 0 : 8,
            padding: hasMiniPlayer ? '12px' : '12px 28px',
            borderRadius: 'var(--radius-full)',
            border: 'none', background: 'var(--text-primary)', color: 'var(--bg-primary)',
            fontFamily: 'var(--font-ui)', fontSize: 'var(--text-sm)', fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            transition: `transform var(--dur-hover) var(--ease), padding 0.25s ease`,
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Plus size={16} strokeWidth={2.5} />
          {!hasMiniPlayer && 'Add'}
        </button>
      </div>

      {showAdd && <AddModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
