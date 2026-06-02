import { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Mic, Square, Play, Pause, Upload, X, Circle } from 'lucide-react'
import api from '../../api/client'

function formatTime(s) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function Recorder({ projectId, folderId, onClose }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState('idle') // idle | recording | preview | saving
  const [blob, setBlob] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [trackName, setTrackName] = useState('')
  const [previewPlaying, setPreviewPlaying] = useState(false)
  const [error, setError] = useState('')
  const [focusName, setFocusName] = useState(false)

  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const audioRef = useRef(null)

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [])

  async function startRecording() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg'

      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const recorded = new Blob(chunksRef.current, { type: mimeType })
        setBlob(recorded)
        setPreviewUrl(URL.createObjectURL(recorded))
        setStatus('preview')
        stream.getTracks().forEach(t => t.stop())
      }

      recorder.start(100)
      recorderRef.current = recorder
      setElapsed(0)
      setStatus('recording')
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } catch {
      setError('Microphone access denied or unavailable')
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current)
    recorderRef.current?.stop()
  }

  function togglePreview() {
    if (!audioRef.current) return
    if (previewPlaying) { audioRef.current.pause(); setPreviewPlaying(false) }
    else { audioRef.current.play(); setPreviewPlaying(true) }
  }

  const upload = useMutation({
    mutationFn: () => {
      const ext = blob.type.includes('ogg') ? '.ogg' : '.webm'
      const file = new File([blob], `recording${ext}`, { type: blob.type })
      const form = new FormData()
      form.append('file', file)
      form.append('name', trackName.trim() || `Recording ${new Date().toLocaleString()}`)
      if (folderId) form.append('folder_id', String(folderId))
      return api.post(`/tracks/project/${projectId}/upload`, form)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tracks', projectId] }); onClose() },
    onError: () => setError('Upload failed'),
  })

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-xl)', padding: 24, width: '100%', maxWidth: 340, boxShadow: 'var(--shadow-modal)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 className="mv-ui" style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mic size={15} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
            Record idea
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, lineHeight: 0, borderRadius: 'var(--radius-sm)' }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {status === 'idle' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <button
              onClick={startRecording}
              style={{
                width: 64, height: 64, borderRadius: '50%', background: '#ef4444',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
              }}
            >
              <Mic size={24} strokeWidth={1.5} style={{ color: '#fff' }} />
            </button>
            <p className="mv-meta" style={{ marginTop: 12, fontSize: 'var(--text-xs)' }}>Click to start recording</p>
          </div>
        )}

        {status === 'recording' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
              <Circle size={8} strokeWidth={0} style={{ fill: '#ef4444', color: '#ef4444', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {formatTime(elapsed)}
              </span>
            </div>
            <button
              onClick={stopRecording}
              style={{
                width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-tertiary)',
                border: '2px solid #ef4444', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
              }}
            >
              <Square size={20} strokeWidth={1.5} style={{ color: '#ef4444' }} />
            </button>
            <p className="mv-meta" style={{ marginTop: 12, fontSize: 'var(--text-xs)' }}>Click to stop</p>
          </div>
        )}

        {status === 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <audio ref={audioRef} src={previewUrl} onEnded={() => setPreviewPlaying(false)} style={{ display: 'none' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
              <button
                onClick={togglePreview}
                style={{
                  width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-strong)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                {previewPlaying
                  ? <Pause size={13} strokeWidth={1.5} style={{ color: 'var(--text-primary)' }} />
                  : <Play size={13} strokeWidth={1.5} style={{ color: 'var(--text-primary)', marginLeft: 1 }} />}
              </button>
              <div>
                <p className="mv-ui" style={{ fontSize: 'var(--text-xs)', fontWeight: 500 }}>Preview</p>
                <p className="mv-mono" style={{ fontSize: 'var(--text-xs)' }}>{formatTime(elapsed)}</p>
              </div>
            </div>

            <input
              style={{
                width: '100%', background: 'var(--bg-tertiary)',
                border: `1px solid ${focusName ? 'var(--border-strong)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)', padding: '8px 12px',
                fontSize: 'var(--text-sm)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-ui)',
              }}
              placeholder="Track name (optional)"
              value={trackName}
              onChange={e => setTrackName(e.target.value)}
              onFocus={() => setFocusName(true)}
              onBlur={() => setFocusName(false)}
            />

            {error && <p style={{ color: '#f87171', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-ui)' }}>{error}</p>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => upload.mutate()}
                disabled={upload.isPending}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: 'var(--accent)', color: '#000', border: 'none',
                  borderRadius: 'var(--radius-md)', padding: '9px 12px',
                  fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-ui)',
                  cursor: upload.isPending ? 'not-allowed' : 'pointer', opacity: upload.isPending ? 0.6 : 1,
                }}
              >
                <Upload size={14} strokeWidth={1.5} /> Save to project
              </button>
              <button
                onClick={() => { setStatus('idle'); setBlob(null); setPreviewUrl(null) }}
                style={{
                  padding: '9px 14px', background: 'transparent', border: 'none',
                  cursor: 'pointer', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)',
                }}
              >
                Redo
              </button>
            </div>
          </div>
        )}

        {status === 'idle' && error && (
          <p style={{ color: '#f87171', fontSize: 'var(--text-xs)', textAlign: 'center', marginTop: 8, fontFamily: 'var(--font-ui)' }}>{error}</p>
        )}
      </div>
    </div>
  )
}
