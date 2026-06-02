import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import WaveSurfer from 'wavesurfer.js'
import { Play, Pause, Music, Lock } from 'lucide-react'

export default function PublicShare() {
  const { token } = useParams()
  const [meta, setMeta] = useState(null)
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [track, setTrack] = useState(null)
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const waveRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    axios.get(`/s/${token}/meta`)
      .then((r) => {
        setMeta(r.data)
        if (!r.data.has_password) {
          setAuthed(true)
          loadTrack('')
        }
      })
      .catch(() => setError('Link not found or expired'))
      .finally(() => setLoading(false))
  }, [token])

  async function loadTrack(pwd) {
    try {
      const r = await axios.get(`/s/${token}/track`, { params: { password: pwd } })
      setTrack(r.data)
    } catch {
      setError('Could not load track')
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      await axios.post(`/s/${token}/auth`, { password })
      setAuthed(true)
      loadTrack(password)
    } catch {
      setError('Wrong password')
    }
  }

  useEffect(() => {
    if (!authed || !waveRef.current || !track) return

    wsRef.current = WaveSurfer.create({
      container: waveRef.current,
      waveColor: '#333',
      progressColor: '#a855f7',
      cursorColor: '#a855f7',
      height: 60,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
    })

    const url = `/s/${token}/stream${password ? `?password=${encodeURIComponent(password)}` : ''}`
    wsRef.current.load(url)
    wsRef.current.on('finish', () => setPlaying(false))

    return () => wsRef.current?.destroy()
  }, [authed, track])

  function togglePlay() {
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
        <div className="flex items-center justify-center mb-6">
          <Lock size={20} className="text-muted" />
        </div>
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
          <button
            type="submit"
            className="w-full bg-accent hover:bg-accent-dim text-white rounded-lg px-4 py-3 text-sm font-medium transition-colors"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
              <Music size={18} className="text-accent" />
            </div>
            <div>
              <h1 className="text-white font-medium text-sm">{track?.name}</h1>
              <p className="text-muted text-xs">
                {track?.versions?.length} version{track?.versions?.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div ref={waveRef} className="mb-4" />

          <button
            onClick={togglePlay}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-dim text-white rounded-xl py-3 text-sm font-medium transition-colors"
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
            {playing ? 'Pause' : 'Play'}
          </button>

          {track?.versions && track.versions.length > 1 && (
            <div className="mt-4 space-y-1">
              <p className="text-muted text-xs mb-2">Versions</p>
              {[...track.versions].reverse().map((v) => (
                <div key={v.version_number} className="flex items-center justify-between text-xs text-muted py-1">
                  <span>v{v.version_number} {v.note && `— ${v.note}`}</span>
                  <span>{new Date(v.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="text-center text-muted text-xs mt-4">MusicVault</p>
      </div>
    </div>
  )
}
