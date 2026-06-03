import { useRef, useEffect, useCallback } from 'react'

// pixels per bar (width + gap)
const BAR_W = 3
const BAR_GAP = 1
const STEP = BAR_W + BAR_GAP

export default function WaveCanvas({
  peaks = [],
  currentTime = 0,
  duration = 0,
  onSeek,
  onScrubStart,
  onScrubEnd,
  loopA = 0,
  loopB = 0,
  loopEnabled = false,
}) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)

  // refs so draw() always reads latest values without re-creating
  const peaksRef = useRef(peaks)
  const timeRef = useRef(currentTime)
  const durationRef = useRef(duration)
  const loopRef = useRef({ a: loopA, b: loopB, enabled: loopEnabled })
  const dragRef = useRef({ active: false, startX: 0, startTime: 0, currentTime: 0 })

  peaksRef.current = peaks
  if (!dragRef.current.active) timeRef.current = currentTime
  durationRef.current = duration
  loopRef.current = { a: loopA, b: loopB, enabled: loopEnabled }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.offsetWidth
    const H = canvas.offsetHeight
    if (!W || !H) return

    // Scale for retina
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.scale(dpr, dpr)
    }

    ctx.clearRect(0, 0, W, H)

    const ps = peaksRef.current
    const numBars = ps.length || 300
    const dur = durationRef.current
    const t = dragRef.current.active ? dragRef.current.currentTime : timeRef.current
    const { a, b, enabled } = loopRef.current

    // Center bar index
    const centerBar = dur > 0 ? (t / dur) * numBars : 0
    const centerX = W / 2

    // px per second (for loop markers)
    const pxPerSec = dur > 0 ? (numBars * STEP) / dur : 1

    // Loop region — clipped to canvas
    if (enabled && dur > 0) {
      const x1 = centerX + (a - t) * pxPerSec
      const x2 = centerX + (b - t) * pxPerSec
      const rx1 = Math.max(0, x1)
      const rx2 = Math.min(W, x2)
      if (rx2 > rx1) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)'
        ctx.fillRect(rx1, 0, rx2 - rx1, H)
      }
    }

    // Bars
    for (let i = 0; i < numBars; i++) {
      const x = centerX + (i - centerBar) * STEP
      if (x + BAR_W < 0 || x > W) continue
      const peak = ps[i] ?? 0
      const barH = Math.max(2, peak * H * 0.85)
      const y = (H - barH) / 2
      const isPast = i < centerBar
      ctx.fillStyle = isPast
        ? 'var(--waveform-active, #fff)'
        : 'var(--waveform-inactive, #2a2a2a)'
      ctx.fillRect(x, y, BAR_W, barH)
    }

    // Loop markers
    if (dur > 0) {
      const drawMarker = (mt, label) => {
        const mx = centerX + (mt - t) * pxPerSec
        if (mx < -4 || mx > W + 4) return
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        ctx.fillRect(mx - 1, 0, 2, H)
        ctx.font = '9px monospace'
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        ctx.fillText(label, mx + 3, 10)
      }
      if (enabled || a > 0) drawMarker(a, 'A')
      if (enabled || b < dur) drawMarker(b, 'B')
    }

    // Fixed center cursor
    ctx.fillStyle = 'var(--waveform-cursor, rgba(255,255,255,0.9))'
    ctx.fillRect(centerX - 1, 0, 2, H)
  }, [])

  // rAF loop
  useEffect(() => {
    let running = true
    const loop = () => {
      if (!running) return
      draw()
      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)
    return () => { running = false; cancelAnimationFrame(animRef.current) }
  }, [draw])

  // Pointer handlers (works for mouse + touch via pointer events)
  const scrubStartedRef = useRef(false)

  const handlePointerDown = useCallback((e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startTime: timeRef.current,
      currentTime: timeRef.current,
    }
    scrubStartedRef.current = false
  }, [])

  const handlePointerMove = useCallback((e) => {
    if (!dragRef.current.active) return
    const dx = e.clientX - dragRef.current.startX
    const dur = durationRef.current
    const numBars = peaksRef.current.length || 300
    const pxPerSec = dur > 0 ? (numBars * STEP) / dur : 1
    // drag left = move forward, drag right = move backward
    const newTime = Math.max(0, Math.min(dur, dragRef.current.startTime - dx / pxPerSec))
    dragRef.current.currentTime = newTime

    if (!scrubStartedRef.current && Math.abs(dx) > 4) {
      scrubStartedRef.current = true
      onScrubStart?.()
    }
  }, [onScrubStart])

  const handlePointerUp = useCallback((e) => {
    if (!dragRef.current.active) return
    const finalTime = dragRef.current.currentTime
    dragRef.current.active = false

    if (scrubStartedRef.current) {
      onScrubEnd?.(finalTime)
    } else {
      // Short tap with no drag = simple seek
      onSeek?.(finalTime)
    }
    scrubStartedRef.current = false
  }, [onSeek, onScrubEnd])

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ display: 'block', width: '100%', height: '100%', cursor: 'grab', touchAction: 'none' }}
    />
  )
}
