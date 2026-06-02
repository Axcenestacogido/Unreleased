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
  let label = days > 0 ? `${days}d ago` : hours > 0 ? `${hours}h ago` : mins > 0 ? `${mins}m ago` : 'just now'
  return <span title={d.toLocaleString()}>{label}</span>
}

export default function AnalyticsPanel({ onClose }) {
  const { connected } = useSSE()
  const { data: links = [], isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => api.get('/analytics').then((r) => r.data),
    // No polling — SSE keeps the cache updated in real-time
  })

  const totalPlays = links.reduce((s, l) => s + l.play_count, 0)

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <BarChart2 size={16} className="text-accent" />
            <h3 className="text-white font-medium">Listen analytics</h3>
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-muted'}`} />
              <span className="text-[10px] text-muted">{connected ? 'Live' : 'Connecting…'}</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {totalPlays > 0 && (
              <span className="text-muted text-xs">{totalPlays} total plays</span>
            )}
            <button onClick={onClose} className="text-muted hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && links.length === 0 && (
            <div className="text-center py-8 text-muted">
              <Link2 size={28} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No shared links yet</p>
            </div>
          )}

          {links.map((link) => (
            <div key={link.token} className="bg-bg border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {link.track_name || link.project_name || 'Unknown'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-muted text-xs">
                      {link.project_name && link.track_name ? 'Track' : link.project_name ? 'Project' : 'Track'}
                    </span>
                    <span className="text-border">·</span>
                    <code className="text-muted text-[10px] font-mono">{link.token.slice(0, 12)}…</code>
                    <a
                      href={`/s/${link.token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted hover:text-accent transition-colors"
                    >
                      <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-accent text-lg font-semibold tabular-nums">{link.play_count}</p>
                  <p className="text-muted text-[10px]">plays</p>
                </div>
              </div>

              {link.expires_at && (
                <p className="text-muted text-xs mb-2">
                  Expires {new Date(link.expires_at).toLocaleDateString()}
                </p>
              )}

              {link.events.length > 0 && (
                <div className="space-y-1">
                  <p className="text-muted text-[10px] uppercase tracking-wider mb-1">Recent listens</p>
                  {[...link.events].reverse().slice(0, 8).map((ev, i) => (
                    <div key={i} className="flex items-center justify-between text-xs text-muted">
                      <span className="font-mono">{ev.ip_hash}</span>
                      <RelativeTime date={ev.timestamp} />
                    </div>
                  ))}
                  {link.play_count > link.events.length && (
                    <p className="text-muted text-[10px] pt-1">
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
