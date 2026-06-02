import { useCallback, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'
import api from '../../api/client'

function UploadItem({ file, projectId, folderId, onDone }) {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('uploading')

  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData()
      form.append('file', file)
      if (folderId) form.append('folder_id', folderId)
      return api.post(`/tracks/project/${projectId}/upload`, form, {
        onUploadProgress: (e) => setProgress(Math.round((e.loaded * 100) / e.total)),
      })
    },
    onSuccess: () => { setStatus('done'); setTimeout(onDone, 1500) },
    onError: () => setStatus('error'),
  })

  useState(() => { upload.mutate() }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="mv-ui" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--text-xs)' }}>
          {file.name}
        </p>
        {status === 'uploading' && (
          <div style={{ marginTop: 4, height: 2, background: 'var(--waveform-inactive)', borderRadius: 1, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--accent)', width: `${progress}%`, transition: 'width 0.1s' }} />
          </div>
        )}
      </div>
      {status === 'done' && <CheckCircle size={14} strokeWidth={1.5} style={{ color: '#4ade80', flexShrink: 0 }} />}
      {status === 'error' && <AlertCircle size={14} strokeWidth={1.5} style={{ color: '#f87171', flexShrink: 0 }} />}
    </div>
  )
}

export default function UploadZone({ projectId, folderId }) {
  const qc = useQueryClient()
  const [dragging, setDragging] = useState(false)
  const [files, setFiles] = useState([])

  const handleDone = useCallback((fileName) => {
    setFiles(prev => prev.filter(f => f.name !== fileName))
    qc.invalidateQueries({ queryKey: ['tracks', projectId] })
  }, [projectId])

  const addFiles = useCallback((newFiles) => {
    const audio = Array.from(newFiles).filter(f => f.type.startsWith('audio/') || /\.(mp3|wav|flac|aac|ogg|m4a)$/i.test(f.name))
    setFiles(prev => [...prev, ...audio])
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const onDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  return (
    <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
      <label
        style={{
          display: 'block', border: `1.5px dashed ${dragging ? 'var(--border-strong)' : 'var(--border)'}`,
          background: dragging ? 'var(--bg-tertiary)' : 'transparent',
          borderRadius: 'var(--radius-lg)', padding: '14px 16px', textAlign: 'center',
          cursor: 'pointer', transition: `all var(--dur-hover) var(--ease)`,
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <input
          type="file" multiple
          accept="audio/*,.mp3,.wav,.flac,.aac,.ogg,.m4a"
          style={{ display: 'none' }}
          onChange={e => addFiles(e.target.files)}
        />
        <Upload size={15} strokeWidth={1.5} style={{ margin: '0 auto 4px', color: 'var(--text-muted)', display: 'block' }} />
        <p className="mv-meta" style={{ fontSize: 'var(--text-xs)' }}>Drop audio files or click to upload</p>
      </label>

      {files.length > 0 && (
        <div style={{ marginTop: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0 12px' }}>
          {files.map(f => (
            <UploadItem
              key={f.name + f.size}
              file={f}
              projectId={projectId}
              folderId={folderId}
              onDone={() => handleDone(f.name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
