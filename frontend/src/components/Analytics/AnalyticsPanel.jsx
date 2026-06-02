import { useQuery } from '@tanstack/react-query'
import { X, BarChart2, Link2, ExternalLink } from 'lucide-react'
import api from '../../api/client'
import { useSSE } from '../../hooks/useSSE'

function RelativeTime({ date }) {
  const d = new Date(date)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  const label = days > 0 ? `${days}d ago` : hours > 0 ? `${hours}h ago` : mins > 0 ? `${mins}m ago` : 'just now'
  return <span title={d.toLocaleString()}>{label}</span>
}

export default function AnalyticsPanel({ onClose }) {
  const { connected } = useSSE()
  const { data: links = [], isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => api.get('/analytics').then(r => r.data),
  })

  const totalPlays = links.reduce((s, l) => s + l.play_count, 0)

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: '12px 12px 0 0', width: '100%', maxWidth: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-modal)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart2 size={15} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
            <h3 className="mv-ui" style={{ fontWeight: 500 }}>Listen analytics</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? '#4ade80' : 'var(--text-muted)', display: 'inline-block' }} />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                {connected ? 'Live' : 'Connecting…'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {totalPlays > 0 && <span className="mv-meta" style={{ fontSize: 'var(--text-xs)' }}>{totalPlays} total plays</span>}
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, lineHeight: 0 }}
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
              <div style={{ width: 18, height: 18, border: '2px solid var(--border-strong)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}

          {!isLoading && links.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '32px 0' }}>
              <Link2 size={28} strokeWidth={1.5} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              <p className="mv-meta">No shared links yet</p>
            </div>
          )}

          {links.map(link => (
            <div key={link.token} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <p className="mv-ui" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                    {link.track_name || link.project_name || 'Unknown'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <span className="mv-meta" style={{ fontSize: 'var(--text-xs)' }}>
                      {link.project_name && link.track_name ? 'Track' : link.project_name ? 'Project' : 'Track'}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>·</span>
                    <code className="mv-mono" style={{ fontSize: 'var(--text-xs)' }}>{link.token.slice(0, 12)}…</code>
                    <a href={`/s/${link.token}`} target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)', lineHeight: 0 }}>
                      <ExternalLink size={10} strokeWidth={1.5} />
                    </a>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>{link.play_count}</p>
                  <p className="mv-meta" style={{ fontSize: 'var(--text-xs)', marginTop: 2 }}>plays</p>
                </div>
              </div>

              {link.expires_at && (
                <p className="mv-meta" style={{ fontSize: 'var(--text-xs)', marginBottom: 8 }}>
                  Expires {new Date(link.expires_at).toLocaleDateString()}
                </p>
              )}

              {link.events.length > 0 && (
                <div>
                  <p className="mv-label" style={{ marginBottom: 6 }}>Recent listens</p>
                  {[...link.events].reverse().slice(0, 8).map((ev, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                      <span className="mv-mono" style={{ fontSize: 'var(--text-xs)' }}>{ev.ip_hash}</span>
                      <span className="mv-meta" style={{ fontSize: 'var(--text-xs)' }}><RelativeTime date={ev.timestamp} /></span>
                    </div>
                  ))}
                  {link.play_count > link.events.length && (
                    <p className="mv-meta" style={{ fontSize: 'var(--text-xs)', marginTop: 4 }}>
                      +{link.play_count - link.events.length} more
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
