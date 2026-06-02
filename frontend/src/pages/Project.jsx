import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import TrackList from '../components/TrackList/TrackList'
import ShareModal from '../components/ShareModal/ShareModal'
import Recorder from '../components/Recorder/Recorder'
import AnalyticsPanel from '../components/Analytics/AnalyticsPanel'

export default function Project() {
  const { id } = useParams()
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [shareTrack, setShareTrack] = useState(null)
  const [shareProject, setShareProject] = useState(false)
  const [showRecorder, setShowRecorder] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get(`/projects/${id}`).then(r => r.data),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      <TrackList
        projectId={id}
        folderId={selectedFolder}
        project={project}
        onShare={setShareTrack}
        onShareProject={() => setShareProject(true)}
        onRecord={() => setShowRecorder(true)}
        onAnalytics={() => setShowAnalytics(true)}
      />

      {shareTrack && <ShareModal track={shareTrack} onClose={() => setShareTrack(null)} />}
      {shareProject && project && <ShareModal project={project} onClose={() => setShareProject(false)} />}
      {showRecorder && <Recorder projectId={id} folderId={selectedFolder} onClose={() => setShowRecorder(false)} />}
      {showAnalytics && <AnalyticsPanel onClose={() => setShowAnalytics(false)} />}
    </div>
  )
}
