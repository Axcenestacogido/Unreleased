import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [focusUser, setFocusUser] = useState(false)
  const [focusPass, setFocusPass] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/')
    } catch {
      setError('Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = (focused) => ({
    width: '100%', background: 'var(--bg-tertiary)',
    border: `1px solid ${focused ? 'var(--border-strong)' : 'var(--border)'}`,
    borderRadius: 'var(--radius-md)', padding: '10px 12px',
    fontSize: 'var(--text-sm)', color: 'var(--text-primary)', outline: 'none',
    fontFamily: 'var(--font-ui)', transition: `border-color var(--dur-hover) var(--ease)`,
  })

  return (
    <div className="mv-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 320 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 600, letterSpacing: 'var(--tracking-display)', color: 'var(--text-primary)', marginBottom: 32, textAlign: 'center' }}>
          MusicVault
        </h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            style={inputStyle(focusUser)}
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onFocus={() => setFocusUser(true)}
            onBlur={() => setFocusUser(false)}
            autoComplete="username"
            required
          />
          <input
            type="password"
            style={inputStyle(focusPass)}
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onFocus={() => setFocusPass(true)}
            onBlur={() => setFocusPass(false)}
            autoComplete="current-password"
            required
          />
          {error && <p style={{ color: '#f87171', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-ui)' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', background: 'var(--accent)', color: '#000',
              border: 'none', borderRadius: 'var(--radius-md)', padding: '10px 12px',
              fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-ui)',
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
              transition: `opacity var(--dur-hover) var(--ease)`,
              marginTop: 4,
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
