import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Check, Trash2, X, ExternalLink } from 'lucide-react'
import api from '../../api/client'

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      style={{
        background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px',
        color: copied ? '#4ade80' : 'var(--text-muted)', display: 'flex', alignItems: 'center',
        borderRadius: 'var(--radius-sm)', flexShrink: 0,
      }}
    >
      {copied ? <Check size={13} strokeWidth={1.5} /> : <Copy size={13} strokeWidth={1.5} />}
    </button>
  )
}

export default function ShareModal({ track, project, onClose }) {
  const isProject = !!project && !track
  const qc = useQueryClient()
  const [password, setPassword] = useState('')
  const [expiresIn, setExpiresIn] = useState('')
  const [newLink, setNewLink] = useState(null)
  const [focusPwd, setFocusPwd] = useState(false)

  const { data: links = [] } = useQuery({
    queryKey: ['share-links'],
    queryFn: () => api.get('/share').then(r => r.data),
    select: (data) => isProject
      ? data.filter(l => l.project_id === project.id)
      : data.filter(l => l.track_id === track.id),
  })

  const createLink = useMutation({
    mutationFn: (data) => api.post('/share', data),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['share-links'] })
      setNewLink(r.data)
      setPassword('')
    },
  })

  const deleteLink = useMutation({
    mutationFn: (token) => api.delete(`/share/${token}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['share-links'] }),
  })

  function handleCreate(e) {
    e.preventDefault()
    let expires_at = null
    if (expiresIn) {
      const d = new Date()
      d.setDate(d.getDate() + parseInt(expiresIn))
      expires_at = d.toISOString()
    }
    createLink.mutate({
      track_id: isProject ? null : track.id,
      project_id: isProject ? project.id : null,
      password: password || null,
      expires_at,
    })
  }

  function shareUrl(tok) {
    return `${window.location.origin}/s/${tok}`
  }

  const inputStyle = (focused) => ({
    width: '100%', background: 'var(--bg-tertiary)',
    border: `1px solid ${focused ? 'var(--border-strong)' : 'var(--border)'}`,
    borderRadius: 'var(--radius-md)', padding: '8px 12px',
    fontSize: 'var(--text-sm)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-ui)',
    transition: `border-color var(--dur-hover) var(--ease)`,
  })

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16, animation: `mvFade var(--dur-modal) var(--ease)` }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-xl)', padding: 24, width: '100%', maxWidth: 440, boxShadow: 'var(--shadow-modal)', animation: `mvScaleIn var(--dur-modal) var(--ease)` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 className="mv-ui" style={{ fontWeight: 500 }}>
            Share — {isProject ? project.name : track.name}
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, lineHeight: 0, borderRadius: 'var(--radius-sm)' }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Create form */}
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <input
            type="password"
            style={inputStyle(focusPwd)}
            placeholder="Password (optional)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onFocus={() => setFocusPwd(true)}
            onBlur={() => setFocusPwd(false)}
            autoComplete="new-password"
          />
          <select
            style={{ ...inputStyle(false), cursor: 'pointer' }}
            value={expiresIn}
            onChange={e => setExpiresIn(e.target.value)}
          >
            <option value="">No expiration</option>
            <option value="1">1 day</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
          </select>
          <button
            type="submit"
            disabled={createLink.isPending}
            style={{
              width: '100%', background: 'var(--accent)', color: '#000', border: 'none',
              borderRadius: 'var(--radius-md)', padding: '9px 12px',
              fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-ui)',
              cursor: createLink.isPending ? 'not-allowed' : 'pointer',
              opacity: createLink.isPending ? 0.6 : 1,
            }}
          >
            Generate link
          </button>
        </form>

        {/* New link result */}
        {newLink && (
          <div style={{ marginBottom: 16, background: 'var(--bg-tertiary)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 6, fontFamily: 'var(--font-ui)' }}>New link created</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <code style={{ flex: 1, fontSize: 'var(--text-xs)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {shareUrl(newLink.token)}
              </code>
              <CopyButton text={shareUrl(newLink.token)} />
              <a
                href={shareUrl(newLink.token)} target="_blank" rel="noreferrer"
                style={{ color: 'var(--text-muted)', padding: '4px 6px', lineHeight: 0, display: 'flex' }}
              >
                <ExternalLink size={13} strokeWidth={1.5} />
              </a>
            </div>
          </div>
        )}

        {/* Active links */}
        {links.length > 0 && (
          <div>
            <p className="mv-label" style={{ marginBottom: 10 }}>Active links ({links.length})</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {links.map(l => (
                <div key={l.token} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 12px' }}>
                  <code style={{ flex: 1, fontSize: 'var(--text-xs)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {shareUrl(l.token)}
                  </code>
                  <span className="mv-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', flexShrink: 0 }}>{l.play_count} plays</span>
                  <CopyButton text={shareUrl(l.token)} />
                  <button
                    onClick={() => deleteLink.mutate(l.token)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 6px', lineHeight: 0, borderRadius: 'var(--radius-sm)', display: 'flex' }}
                  >
                    <Trash2 size={12} strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
