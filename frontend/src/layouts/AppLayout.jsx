import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { PlayerProvider } from '../hooks/usePlayer'
import { SSEProvider } from '../hooks/useSSE'
import Sidebar from '../components/Sidebar/Sidebar'
import Player from '../components/Player/Player'

export default function AppLayout() {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return (
    <PlayerProvider>
      <SSEProvider>
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>
          {/* Left: Sidebar 240px */}
          <Sidebar />
          {/* Center: content */}
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Outlet />
          </div>
          {/* Right: Player 320px */}
          <Player />
        </div>
      </SSEProvider>
    </PlayerProvider>
  )
}
