import { useEffect, useState } from 'react'
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  ChevronUp, ChevronDown, Repeat, RefreshCw,
} from 'lucide-react'
import { usePlayer } from '../../hooks/usePlayer'
import { useAudioEngine } from '../../hooks/useAudioEngine'
import WaveCanvas from './WaveCanvas'

function fmt(s) {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function Slider({ label, value, min, max, step, format, onChange }) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <span className="text-muted text-[10px] uppercase tracking-wider">{label}</span>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-24 accent-accent"
      />
      <span className="text-white text-[10px] tabular-nums">{format(value)}</span>
    </div>
  )
}

export default function Player({ onRecord }) {
  const { currentTrack, playNext, playPrev } = usePlayer()
  const engine = useAudioEngine()
  const [expanded, setExpanded] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)
  const [clickMode, setClickMode] = useState('seek')

  // Load track when it changes
  useEffect(() => {
    if (!currentTrack) return
    engine.loadTrack(currentTrack.id).then(() => {
      engine.play(0)
    })
  }, [currentTrack?.id])

  // Volume via Tone.js master gain
  useEffect(() => {
    try {
      const { Tone } = window
      if (Tone) Tone.getDestination().volume.value = muted ? -Infinity : 20 * Math.log10(volume)
    } catch {}
  }, [volume, muted])

  function togglePlay() {
    if (engine.playing) engine.pause()
    else engine.play()
  }

  function handleSeek(t, newA, newB) {
    if (t !== null && t !== undefined) {
      engine.seek(t)
    }
    if (newA !== undefined && newB !== undefined) {
      engine.setLoopPoints(newA, newB)
    }
  }

  function handleLoopToggle() {
    const next = !engine.loopEnabled
    engine.setLoopEnabled(next)
    if (next && engine.loopB <= engine.loopA) {
      engine.setLoopPoints(0, engine.duration)
    }
  }

  if (!currentTrack) return null

  const currentVer = currentTrack.versions?.[currentTrack.versions.length - 1]

  return (
    <div className={`fixed bottom-0 left-0 right-0 bg-[#0f0f0f] border-t border-border z-50 transition-all duration-200 ${expanded ? 'pb-1' : ''}`}>
      {/* Main bar */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Playback controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={playPrev} className="text-muted hover:text-white p-1 transition-colors">
            <SkipBack size={15} />
          </button>
          <button
            onClick={togglePlay}
            className="w-8 h-8 bg-accent hover:bg-accent-dim rounded-full flex items-center justify-center transition-colors"
          >
            {engine.playing
              ? <Pause size={13} className="text-white" />
              : <Play size={13} className="text-white ml-0.5" />}
          </button>
          <button onClick={playNext} className="text-muted hover:text-white p-1 transition-colors">
            <SkipForward size={15} />
          </button>
        </div>

        {/* Track info */}
        <div className="flex-shrink-0 w-28 hidden sm:block">
          <p className="text-white text-xs font-medium truncate">{currentTrack.name}</p>
          {currentVer && <p className="text-muted text-[10px]">v{currentVer.version_number}</p>}
        </div>

        {/* Waveform */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-muted text-[10px] flex-shrink-0 tabular-nums w-8 text-right">
            {fmt(engine.currentTime)}
          </span>
          <div className="flex-1 h-8 min-w-0">
            {engine.isLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <WaveCanvas
                peaks={engine.peaks}
                currentTime={engine.currentTime}
                duration={engine.duration}
                onSeek={handleSeek}
                loopA={engine.loopA}
                loopB={engine.loopB}
                loopEnabled={engine.loopEnabled}
                clickMode={clickMode}
                onClickDone={() => setClickMode('seek')}
              />
            )}
          </div>
          <span className="text-muted text-[10px] flex-shrink-0 tabular-nums w-8">
            {fmt(engine.duration)}
          </span>
        </div>

        {/* Volume + expand */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setMuted(!muted)} className="text-muted hover:text-white transition-colors p-1">
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <input
            type="range" min={0} max={1} step={0.02}
            value={muted ? 0 : volume}
            onChange={(e) => { setVolume(+e.target.value); setMuted(false) }}
            className="w-14 accent-accent hidden sm:block"
          />
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted hover:text-white p-1 transition-colors"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {/* Expanded panel: pitch / speed / loop */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 flex flex-wrap items-center justify-center gap-6">
          <Slider
            label="Speed"
            value={engine.speed}
            min={0.5} max={2} step={0.05}
            format={(v) => `${v.toFixed(2)}x`}
            onChange={engine.setSpeed}
          />

          <Slider
            label="Pitch"
            value={engine.pitch}
            min={-12} max={12} step={1}
            format={(v) => `${v > 0 ? '+' : ''}${v}st`}
            onChange={engine.setPitch}
          />

          {/* Loop A-B */}
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-muted text-[10px] uppercase tracking-wider">Loop A-B</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setClickMode(clickMode === 'setA' ? 'seek' : 'setA')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  clickMode === 'setA' ? 'bg-accent text-white' : 'bg-surface text-muted hover:text-white border border-border'
                }`}
              >
                A {fmt(engine.loopA)}
              </button>
              <button
                onClick={() => setClickMode(clickMode === 'setB' ? 'seek' : 'setB')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  clickMode === 'setB' ? 'bg-accent text-white' : 'bg-surface text-muted hover:text-white border border-border'
                }`}
              >
                B {fmt(engine.loopB)}
              </button>
              <button
                onClick={handleLoopToggle}
                className={`p-1.5 rounded transition-colors ${
                  engine.loopEnabled ? 'text-accent bg-accent/10' : 'text-muted hover:text-white'
                }`}
                title="Toggle loop"
              >
                <Repeat size={13} />
              </button>
              <button
                onClick={() => {
                  engine.setLoopPoints(0, engine.duration)
                  engine.setPitch(0)
                  engine.setSpeed(1)
                }}
                className="p-1.5 text-muted hover:text-white rounded transition-colors"
                title="Reset all"
              >
                <RefreshCw size={13} />
              </button>
            </div>
            <span className="text-muted text-[10px]">
              {clickMode !== 'seek' ? `Click waveform to set ${clickMode === 'setA' ? 'A' : 'B'}` : 'Click A/B to set markers'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
