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
    <button onClick={copy} className="p-1.5 text-muted hover:text-white transition-colors">
      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
    </button>
  )
}

// track OR project must be passed
export default function ShareModal({ track, project, onClose }) {
  const isProject = !!project && !track
  const qc = useQueryClient()
  const [password, setPassword] = useState('')
  const [expiresIn, setExpiresIn] = useState('')
  const [newLink, setNewLink] = useState(null)

  const { data: links = [] } = useQuery({
    queryKey: ['share-links'],
    queryFn: () => api.get('/share').then((r) => r.data),
    select: (data) => isProject
      ? data.filter((l) => l.project_id === project.id)
      : data.filter((l) => l.track_id === track.id),
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

  function shareUrl(token) {
    return `${window.location.origin}/s/${token}`
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-medium">Share — {isProject ? project.name : track.name}</h3>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-3 mb-6">
          <input
            type="password"
            className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-muted focus:outline-none focus:border-accent"
            placeholder="Password (optional)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <select
            className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
            value={expiresIn}
            onChange={(e) => setExpiresIn(e.target.value)}
          >
            <option value="">No expiration</option>
            <option value="1">1 day</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
          </select>
          <button
            type="submit"
            disabled={createLink.isPending}
            className="w-full bg-accent hover:bg-accent-dim disabled:opacity-50 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
          >
            Generate link
          </button>
        </form>

        {newLink && (
          <div className="mb-4 bg-bg border border-accent/30 rounded-xl p-3">
            <p className="text-accent text-xs mb-2 font-medium">New link created</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-white text-xs truncate font-mono">{shareUrl(newLink.token)}</code>
              <CopyButton text={shareUrl(newLink.token)} />
              <a href={shareUrl(newLink.token)} target="_blank" rel="noreferrer" className="p-1.5 text-muted hover:text-white transition-colors">
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        )}

        {links.length > 0 && (
          <div>
            <p className="text-muted text-xs mb-2">Active links ({links.length})</p>
            <div className="space-y-2">
              {links.map((l) => (
                <div key={l.token} className="flex items-center gap-2 bg-bg border border-border rounded-xl px-3 py-2.5">
                  <code className="flex-1 text-white text-xs truncate font-mono">{shareUrl(l.token)}</code>
                  <span className="text-muted text-[10px] flex-shrink-0">{l.play_count} plays</span>
                  <CopyButton text={shareUrl(l.token)} />
                  <button
                    onClick={() => deleteLink.mutate(l.token)}
                    className="p-1.5 text-muted hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={12} />
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
