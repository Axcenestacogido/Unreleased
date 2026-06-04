import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { PlayerProvider } from '../hooks/usePlayer'
import { SSEProvider } from '../hooks/useSSE'
import Sidebar from '../components/Sidebar/Sidebar'
import Player from '../components/Player/Player'

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mobile
}

export default function AppLayout() {
  const { token } = useAuth()
  const isMobile = useIsMobile()
  const location = useLocation()

  if (!token) return <Navigate to="/login" replace />

  return (
    <PlayerProvider>
      <SSEProvider>
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>
          {!isMobile && <Sidebar />}
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div key={location.pathname} className="mv-page" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Outlet />
            </div>
          </div>
          {!isMobile && <Player />}
          {isMobile && <Player isMobile />}
        </div>
      </SSEProvider>
    </PlayerProvider>
  )
}
