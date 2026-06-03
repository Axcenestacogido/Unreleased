import { useState, useEffect } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { PlayerProvider } from '../hooks/usePlayer'
import { SSEProvider } from '../hooks/useSSE'
import Sidebar from '../components/Sidebar/Sidebar'
import Player from '../components/Player/Player'
import MobileLayout from './MobileLayout'

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return mobile
}

export default function AppLayout() {
  const { token } = useAuth()
  const isMobile = useIsMobile()
  if (!token) return <Navigate to="/login" replace />

  return (
    <PlayerProvider>
      <SSEProvider>
        {isMobile ? (
          <MobileLayout />
        ) : (
          <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>
            <Sidebar />
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Outlet />
            </div>
            <Player />
          </div>
        )}
      </SSEProvider>
    </PlayerProvider>
  )
}
