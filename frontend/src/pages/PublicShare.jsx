import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import WaveSurfer from 'wavesurfer.js'
import { Play, Pause, Lock, SkipBack, SkipForward } from 'lucide-react'

function TrackPlayer({ token, trackId, trackName, versions, password }) {
  const waveRef = useRef(null)
  const wsRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState(null)

  useEffect(() => {
    if (!waveRef.current) return
    wsRef.current?.destroy()

    const ws = WaveSurfer.create({
      container: waveRef.current,
      waveColor: '#2a2a2a',
      progressColor: '#ffffff',
      cursorColor: 'transparent',
      height: 48,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
    })

    const ver = selectedVersion || (versions.length ? versions[versions.length - 1].version_number : undefined)
    const params = new URLSearchParams()
    if (password) params.set('password', password)
    if (ver) params.set('version', ver)
    const url = `/s/${token}/stream/${trackId}?${params}`
    ws.load(url)
    ws.on('finish', () => setPlaying(false))
    wsRef.current = ws

    return () => ws.destroy()
  }, [token, trackId, selectedVersion, password])

  function toggle() {
    if (!wsRef.current) return
    if (playing) wsRef.current.pause()
    else wsRef.current.play()
    setPlaying(!playing)
  }

  return (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={toggle}
          style={{
            width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-tertiary)',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          {playing
            ? <Pause size={13} strokeWidth={1.5} style={{ color: 'var(--text-primary)' }} />
            : <Play size={13} strokeWidth={1.5} style={{ color: 'var(--text-primary)', marginLeft: 1 }} />}
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p className="mv-ui" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trackName}</p>
          {versions.length > 1 && (
            <select
              style={{ background: 'transparent', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', border: 'none', outline: 'none', fontFamily: 'var(--font-ui)', marginTop: 2 }}
              value={selectedVersion || ''}
              onChange={e => setSelectedVersion(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">Latest (v{versions[versions.length - 1]?.version_number})</option>
              {[...versions].reverse().map(v => (
                <option key={v.version_number} value={v.version_number}>
                  v{v.version_number}{v.note ? ` — ${v.note}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      <div ref={waveRef} />
    </div>
  )
}

export default function PublicShare() {
  const { token } = useParams()
  const [meta, setMeta] = useState(null)
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [content, setContent] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [focusPwd, setFocusPwd] = useState(false)

  const waveRef = useRef(null)
  const wsRef = useRef(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    axios.get(`/s/${token}/meta`)
      .then(r => {
        setMeta(r.data)
        if (!r.data.has_password) {
          setAuthed(true)
          loadContent(r.data, '')
        }
      })
      .catch(() => setError('Link not found or expired'))
      .finally(() => setLoading(false))
  }, [token])

  async function loadContent(metaData, pwd) {
    try {
      if (metaData.track_id) {
        const r = await axios.get(`/s/${token}/track`, { params: pwd ? { password: pwd } : {} })
        setContent({ type: 'track', ...r.data })
      } else if (metaData.project_id) {
        const r = await axios.get(`/s/${token}/project`, { params: pwd ? { password: pwd } : {} })
        setContent({ type: 'project', ...r.data })
      }
    } catch {
      setError('Could not load content')
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      await axios.post(`/s/${token}/auth`, { password })
      setAuthed(true)
      loadContent(meta, password)
    } catch {
      setError('Wrong password')
    }
  }

  // Single track waveform
  useEffect(() => {
    if (!authed || !waveRef.current || !content || content.type !== 'track') return
    wsRef.current?.destroy()

    const ws = WaveSurfer.create({
      container: waveRef.current,
      waveColor: '#2a2a2a',
      progressColor: '#ffffff',
      cursorColor: 'rgba(255,255,255,0.8)',
      height: 96,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
    })

    const params = new URLSearchParams()
    if (password) params.set('password', password)
    ws.load(`/s/${token}/stream?${params}`)
    ws.on('finish', () => setPlaying(false))
    wsRef.current = ws

    return () => ws.destroy()
  }, [authed, content?.type])

  function toggleSingle() {
    if (!wsRef.current) return
    if (playing) wsRef.current.pause()
    else wsRef.current.play()
    setPlaying(!playing)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 18, height: 18, border: '2px solid var(--border-strong)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (error && !meta) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p className="mv-meta">{error}</p>
    </div>
  )

  if (meta?.has_password && !authed) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <Lock size={20} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
        <p className="mv-track-title" style={{ textAlign: 'center' }}>This track is private</p>
        <p className="mv-meta" style={{ textAlign: 'center' }}>Enter the password to listen</p>
        <form onSubmit={handlePasswordSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="password"
            autoFocus
            style={{
              width: '100%', background: 'var(--bg-tertiary)',
              border: `1px solid ${focusPwd ? 'var(--border-strong)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)', padding: '10px 12px',
              fontSize: 'var(--text-sm)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-ui)',
            }}
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onFocus={() => setFocusPwd(true)}
            onBlur={() => setFocusPwd(false)}
          />
          {error && <p style={{ color: '#f87171', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-ui)' }}>{error}</p>}
          <button
            type="submit"
            style={{
              width: '100%', background: 'var(--accent)', color: '#000', border: 'none',
              borderRadius: 'var(--radius-md)', padding: '10px 12px',
              fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-ui)', cursor: 'pointer',
            }}
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Single track */}
        {content?.type === 'track' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <span className="mv-label" style={{ display: 'block', marginBottom: 10 }}>
                {content.project_name || 'TRACK'}
              </span>
              <h1 className="mv-h1" style={{ marginBottom: 6 }}>{content.name}</h1>
              <p className="mv-meta">{content.artist || ''}</p>
            </div>

            <div ref={waveRef} style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }} />

            {/* Transport */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <button
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}
              >
                <SkipBack size={16} strokeWidth={1.5} />
              </button>
              <button
                onClick={toggleSingle}
                style={{
                  width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-strong)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                {playing
                  ? <Pause size={18} strokeWidth={1.5} style={{ color: 'var(--text-primary)' }} />
                  : <Play size={18} strokeWidth={1.5} style={{ color: 'var(--text-primary)', marginLeft: 2 }} />}
              </button>
              <button
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}
              >
                <SkipForward size={16} strokeWidth={1.5} />
              </button>
            </div>

            {content.versions?.length > 1 && (
              <div style={{ marginTop: 8 }}>
                <p className="mv-label" style={{ marginBottom: 8 }}>Versions</p>
                {[...content.versions].reverse().map(v => (
                  <div key={v.version_number} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span className="mv-meta" style={{ fontSize: 'var(--text-xs)' }}>v{v.version_number}{v.note ? ` — ${v.note}` : ''}</span>
                    <span className="mv-meta" style={{ fontSize: 'var(--text-xs)' }}>{new Date(v.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Project track list */}
        {content?.type === 'project' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <span className="mv-label" style={{ display: 'block', marginBottom: 6 }}>PROJECT</span>
              <h1 className="mv-h1" style={{ marginBottom: 4 }}>{content.name}</h1>
              {content.description && <p className="mv-meta">{content.description}</p>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {content.tracks?.length === 0 && (
                <p className="mv-meta" style={{ textAlign: 'center', padding: '24px 0' }}>No tracks</p>
              )}
              {content.tracks?.map(t => (
                <TrackPlayer
                  key={t.id}
                  token={token}
                  trackId={t.id}
                  trackName={t.name}
                  versions={t.versions}
                  password={password}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="mv-meta" style={{ marginTop: 48, color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>MusicVault</p>
    </div>
  )
}
