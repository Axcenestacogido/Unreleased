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

  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const audioRef = useRef(null)

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
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

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const recorded = new Blob(chunksRef.current, { type: mimeType })
        setBlob(recorded)
        setPreviewUrl(URL.createObjectURL(recorded))
        setStatus('preview')
        stream.getTracks().forEach((t) => t.stop())
      }

      recorder.start(100) // collect every 100ms
      recorderRef.current = recorder
      setElapsed(0)
      setStatus('recording')

      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } catch (err) {
      setError('Microphone access denied or unavailable')
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current)
    recorderRef.current?.stop()
  }

  function togglePreview() {
    if (!audioRef.current) return
    if (previewPlaying) {
      audioRef.current.pause()
      setPreviewPlaying(false)
    } else {
      audioRef.current.play()
      setPreviewPlaying(true)
    }
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tracks', projectId] })
      onClose()
    },
    onError: () => setError('Upload failed'),
  })

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-medium flex items-center gap-2">
            <Mic size={16} className="text-accent" /> Record idea
          </h3>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {status === 'idle' && (
          <div className="text-center py-4">
            <button
              onClick={startRecording}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center mx-auto transition-colors"
            >
              <Mic size={24} className="text-white" />
            </button>
            <p className="text-muted text-xs mt-3">Click to start recording</p>
          </div>
        )}

        {status === 'recording' && (
          <div className="text-center py-4">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Circle size={8} className="text-red-500 animate-pulse fill-red-500" />
              <span className="text-white tabular-nums font-mono text-lg">{formatTime(elapsed)}</span>
            </div>
            <button
              onClick={stopRecording}
              className="w-16 h-16 rounded-full bg-surface border-2 border-red-500 hover:bg-red-500/10 flex items-center justify-center mx-auto transition-colors"
            >
              <Square size={20} className="text-red-500" />
            </button>
            <p className="text-muted text-xs mt-3">Click to stop</p>
          </div>
        )}

        {status === 'preview' && (
          <div className="space-y-3">
            <audio
              ref={audioRef}
              src={previewUrl}
              onEnded={() => setPreviewPlaying(false)}
              className="hidden"
            />

            <div className="flex items-center gap-3 bg-bg border border-border rounded-xl px-4 py-3">
              <button
                onClick={togglePreview}
                className="w-8 h-8 rounded-full bg-accent hover:bg-accent-dim flex items-center justify-center flex-shrink-0 transition-colors"
              >
                {previewPlaying
                  ? <Pause size={13} className="text-white" />
                  : <Play size={13} className="text-white ml-0.5" />}
              </button>
              <div>
                <p className="text-white text-xs font-medium">Preview</p>
                <p className="text-muted text-[10px]">{formatTime(elapsed)}</p>
              </div>
            </div>

            <input
              className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-muted focus:outline-none focus:border-accent"
              placeholder="Track name (optional)"
              value={trackName}
              onChange={(e) => setTrackName(e.target.value)}
            />

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => upload.mutate()}
                disabled={upload.isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-accent-dim disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
              >
                <Upload size={14} /> Save to project
              </button>
              <button
                onClick={() => { setStatus('idle'); setBlob(null); setPreviewUrl(null) }}
                className="px-4 text-muted hover:text-white text-sm transition-colors"
              >
                Redo
              </button>
            </div>
          </div>
        )}

        {status === 'idle' && error && (
          <p className="text-red-400 text-xs text-center mt-2">{error}</p>
        )}
      </div>
    </div>
  )
}
