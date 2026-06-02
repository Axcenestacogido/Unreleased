import { useEffect, useRef, useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'
import WaveSurfer from 'wavesurfer.js'
import { usePlayer } from '../../hooks/usePlayer'

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function Player() {
  const { currentTrack, playNext, playPrev } = usePlayer()
  const waveRef = useRef(null)
  const wsRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    if (!currentTrack || !waveRef.current) return

    wsRef.current?.destroy()

    const ws = WaveSurfer.create({
      container: waveRef.current,
      waveColor: '#333',
      progressColor: '#a855f7',
      cursorColor: 'transparent',
      height: 32,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      interact: true,
    })

    ws.load(`/api/tracks/${currentTrack.id}/stream`)
    ws.setVolume(volume)
    ws.on('ready', () => {
      setDuration(ws.getDuration())
      ws.play()
      setPlaying(true)
    })
    ws.on('timeupdate', (t) => setCurrentTime(t))
    ws.on('finish', () => {
      setPlaying(false)
      playNext()
    })

    wsRef.current = ws
    return () => ws.destroy()
  }, [currentTrack?.id])

  useEffect(() => {
    wsRef.current?.setVolume(muted ? 0 : volume)
  }, [volume, muted])

  function togglePlay() {
    if (!wsRef.current) return
    if (playing) wsRef.current.pause()
    else wsRef.current.play()
    setPlaying(!playing)
  }

  if (!currentTrack) return null

  const currentVer = currentTrack.versions?.[currentTrack.versions.length - 1]

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#111] border-t border-border z-50 px-4 py-3">
      <div className="max-w-2xl mx-auto flex items-center gap-4">
        {/* Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={playPrev} className="text-muted hover:text-white transition-colors p-1">
            <SkipBack size={16} />
          </button>
          <button
            onClick={togglePlay}
            className="w-8 h-8 bg-accent hover:bg-accent-dim rounded-full flex items-center justify-center transition-colors"
          >
            {playing ? <Pause size={14} className="text-white" /> : <Play size={14} className="text-white ml-0.5" />}
          </button>
          <button onClick={playNext} className="text-muted hover:text-white transition-colors p-1">
            <SkipForward size={16} />
          </button>
        </div>

        {/* Track info */}
        <div className="flex-shrink-0 w-28 hidden sm:block">
          <p className="text-white text-xs font-medium truncate">{currentTrack.name}</p>
          {currentVer && <p className="text-muted text-[10px]">v{currentVer.version_number}</p>}
        </div>

        {/* Waveform */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-muted text-[10px] flex-shrink-0 tabular-nums">{formatTime(currentTime)}</span>
          <div ref={waveRef} className="flex-1 min-w-0" />
          <span className="text-muted text-[10px] flex-shrink-0 tabular-nums">{formatTime(duration)}</span>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setMuted(!muted)} className="text-muted hover:text-white transition-colors">
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={muted ? 0 : volume}
            onChange={(e) => { setVolume(+e.target.value); setMuted(false) }}
            className="w-16 accent-accent hidden sm:block"
          />
        </div>
      </div>
    </div>
  )
}
