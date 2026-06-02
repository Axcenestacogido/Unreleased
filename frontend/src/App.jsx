import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useSSE } from './hooks/useSSE'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Project from './pages/Project'
import PublicShare from './pages/PublicShare'

// Mounts SSE connection while authenticated, provides `connected` via context if needed
function LiveSync() {
  useSSE()
  return null
}

function PrivateRoute({ children }) {
  const { token } = useAuth()
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { token } = useAuth()

  return (
    <BrowserRouter>
      {token && <LiveSync />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/s/:token" element={<PublicShare />} />
        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/project/:id" element={<PrivateRoute><Project /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
