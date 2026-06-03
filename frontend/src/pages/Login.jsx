import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api from '../api/client'

export default function Login() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
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
      if (mode === 'register') {
        await api.post('/auth/register', { username, password })
      }
      await login(username, password)
      navigate('/')
    } catch (err) {
      const msg = err?.response?.data?.detail
      setError(msg || (mode === 'register' ? 'Registration failed' : 'Invalid username or password'))
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 320 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 600, letterSpacing: 'var(--tracking-display)', color: 'var(--text-primary)', marginBottom: 32, textAlign: 'center' }}>
          MusicVault
        </h1>

        {/* Tab switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
          {['login', 'register'].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError('') }}
              style={{
                flex: 1, background: 'none', border: 'none', cursor: 'pointer',
                padding: '8px 0', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)',
                color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: mode === m ? 500 : 400,
                borderBottom: `2px solid ${mode === m ? 'var(--accent)' : 'transparent'}`,
                marginBottom: -1, transition: `all var(--dur-hover) var(--ease)`,
              }}
            >
              {m === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

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
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            required
          />
          {error && <p style={{ color: '#f87171', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-ui)', margin: 0 }}>{error}</p>}
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
            {loading ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
