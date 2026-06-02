import { useCallback, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react'
import api from '../../api/client'

function UploadItem({ file, projectId, folderId, onDone }) {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('uploading') // uploading | done | error

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
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs truncate">{file.name}</p>
        {status === 'uploading' && (
          <div className="mt-1 h-0.5 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      {status === 'done' && <CheckCircle size={14} className="text-green-400 flex-shrink-0" />}
      {status === 'error' && <AlertCircle size={14} className="text-red-400 flex-shrink-0" />}
    </div>
  )
}

export default function UploadZone({ projectId, folderId }) {
  const qc = useQueryClient()
  const [dragging, setDragging] = useState(false)
  const [files, setFiles] = useState([])

  const handleDone = useCallback((fileName) => {
    setFiles((prev) => prev.filter((f) => f.name !== fileName))
    qc.invalidateQueries({ queryKey: ['tracks', projectId] })
  }, [projectId])

  const addFiles = useCallback((newFiles) => {
    const audio = Array.from(newFiles).filter((f) => f.type.startsWith('audio/') || /\.(mp3|wav|flac|aac|ogg|m4a)$/i.test(f.name))
    setFiles((prev) => [...prev, ...audio])
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const onDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  return (
    <div className="px-4 pt-4">
      <label
        className={`block border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
          dragging ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'
        }`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <input
          type="file"
          multiple
          accept="audio/*,.mp3,.wav,.flac,.aac,.ogg,.m4a"
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
        <Upload size={16} className="mx-auto text-muted mb-1" />
        <p className="text-muted text-xs">Drop audio files or click to upload</p>
      </label>

      {files.length > 0 && (
        <div className="mt-3 bg-surface border border-border rounded-xl px-4 divide-y divide-border">
          {files.map((f) => (
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
