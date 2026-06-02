import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import WaveSurfer from 'wavesurfer.js'
import { Play, Pause, Music, Lock, List } from 'lucide-react'

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
      progressColor: '#a855f7',
      cursorColor: 'transparent',
      height: 50,
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
    <div className="bg-bg border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="w-8 h-8 rounded-full bg-accent hover:bg-accent-dim flex items-center justify-center flex-shrink-0 transition-colors"
        >
          {playing ? <Pause size={13} className="text-white" /> : <Play size={13} className="text-white ml-0.5" />}
        </button>
        <div className="min-w-0">
          <p className="text-white text-sm font-medium truncate">{trackName}</p>
          {versions.length > 1 && (
            <select
              className="mt-0.5 bg-transparent text-muted text-xs focus:outline-none"
              value={selectedVersion || ''}
              onChange={(e) => setSelectedVersion(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">Latest (v{versions[versions.length - 1]?.version_number})</option>
              {[...versions].reverse().map((v) => (
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
  const [content, setContent] = useState(null) // track or project data
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  // Waveform for single track mode
  const waveRef = useRef(null)
  const wsRef = useRef(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    axios.get(`/s/${token}/meta`)
      .then((r) => {
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
      progressColor: '#a855f7',
      cursorColor: '#a855f7',
      height: 64,
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
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error && !meta) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <p className="text-muted text-sm">{error}</p>
    </div>
  )

  if (meta?.has_password && !authed) return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Lock size={20} className="text-muted mx-auto mb-6" />
        <form onSubmit={handlePasswordSubmit} className="space-y-3">
          <input
            type="password"
            autoFocus
            className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-white placeholder-muted focus:outline-none focus:border-accent"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button type="submit" className="w-full bg-accent hover:bg-accent-dim text-white rounded-lg py-3 text-sm font-medium transition-colors">
            Unlock
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Single track */}
        {content?.type === 'track' && (
          <div className="bg-surface border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
                <Music size={18} className="text-accent" />
              </div>
              <div>
                <h1 className="text-white font-medium">{content.name}</h1>
                <p className="text-muted text-xs">{content.versions?.length} version{content.versions?.length !== 1 ? 's' : ''}</p>
              </div>
            </div>

            <div ref={waveRef} className="mb-4" />

            <button
              onClick={toggleSingle}
              className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-dim text-white rounded-xl py-3 text-sm font-medium transition-colors"
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
              {playing ? 'Pause' : 'Play'}
            </button>

            {content.versions?.length > 1 && (
              <div className="mt-4 space-y-1">
                <p className="text-muted text-xs mb-2">Versions</p>
                {[...content.versions].reverse().map((v) => (
                  <div key={v.version_number} className="flex items-center justify-between text-xs text-muted py-1">
                    <span>v{v.version_number}{v.note ? ` — ${v.note}` : ''}</span>
                    <span>{new Date(v.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Project track list */}
        {content?.type === 'project' && (
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-3">
              <div className="w-9 h-9 bg-accent/20 rounded-lg flex items-center justify-center">
                <List size={16} className="text-accent" />
              </div>
              <div>
                <h1 className="text-white font-medium">{content.name}</h1>
                {content.description && <p className="text-muted text-xs">{content.description}</p>}
              </div>
            </div>

            <div className="p-4 space-y-3">
              {content.tracks?.length === 0 && (
                <p className="text-muted text-sm text-center py-4">No tracks</p>
              )}
              {content.tracks?.map((t) => (
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

        <p className="text-center text-muted text-xs mt-4">MusicVault</p>
      </div>
    </div>
  )
}
