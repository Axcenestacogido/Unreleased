import { Outlet, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { PlayerProvider, usePlayer } from '../hooks/usePlayer'
import { SSEProvider } from '../hooks/useSSE'
import Sidebar from '../components/Sidebar/Sidebar'
import Player from '../components/Player/Player'
import { Play, Pause, Music2 } from 'lucide-react'

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mobile
}

function MobilePlayer() {
  const { currentTrack, engine } = usePlayer()
  if (!currentTrack) return null

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)',
      padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 'var(--radius-md)',
        background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Music2 size={16} strokeWidth={1} style={{ color: 'var(--text-muted)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mv-ui" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--text-sm)' }}>
          {currentTrack.name}
        </div>
        <div className="mv-meta" style={{ fontSize: 'var(--text-xs)' }}>
          {currentTrack.project_name || ''}
        </div>
      </div>
      <button
        onClick={() => engine.playing ? engine.pause() : engine.play()}
        style={{
          width: 40, height: 40, borderRadius: '50%', border: 'none',
          background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        {engine.playing
          ? <Pause size={16} strokeWidth={1.5} />
          : <Play size={16} strokeWidth={1.5} style={{ marginLeft: 2 }} />}
      </button>
    </div>
  )
}

export default function AppLayout() {
  const { token } = useAuth()
  const isMobile = useIsMobile()

  if (!token) return <Navigate to="/login" replace />

  return (
    <PlayerProvider>
      <SSEProvider>
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>
          {!isMobile && <Sidebar />}
          <div style={{
            flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column',
            paddingBottom: isMobile ? 60 : 0,
          }}>
            <Outlet />
          </div>
          {!isMobile && <Player />}
          {isMobile && <MobilePlayer />}
        </div>
      </SSEProvider>
    </PlayerProvider>
  )
}
