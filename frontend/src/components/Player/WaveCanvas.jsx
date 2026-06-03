import { useRef, useEffect, useCallback } from 'react'

const PLAYHEAD_RATIO = 0.5

export default function WaveCanvas({
  peaks = [],
  currentTime = 0,
  duration = 0,
  onSeek,       // called on tap (instant seek)
  onScrubStart, // called when drag begins (pause audio)
  onScrubEnd,   // called on drag release with final time (seek + resume)
  loopA = 0,
  loopB = 0,
  loopEnabled = false,
  clickMode = 'seek',
  onClickDone,
}) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const peaksRef = useRef(peaks)
  const timeRef = useRef(currentTime)
  const durationRef = useRef(duration)
  const loopRef = useRef({ a: loopA, b: loopB, enabled: loopEnabled })
  // dragRef.dragTime: visual override time during drag (null = not dragging)
  const dragRef = useRef(null)

  peaksRef.current = peaks
  timeRef.current = currentTime
  durationRef.current = duration
  loopRef.current = { a: loopA, b: loopB, enabled: loopEnabled }

  // Returns display metrics. Uses drag override time when dragging.
  function getMetrics() {
    const canvas = canvasRef.current
    if (!canvas) return null
    const W = canvas.offsetWidth
    const ps = peaksRef.current
    const barW = 2, barGap = 1, step = barW + barGap
    const numBars = ps.length || Math.floor(W / step)
    const totalVW = numBars * step
    const playheadX = W * PLAYHEAD_RATIO
    const dur = durationRef.current || 1
    const displayTime = (dragRef.current?.dragTime != null) ? dragRef.current.dragTime : timeRef.current
    const progress = dur > 0 ? displayTime / dur : 0
    const currentVX = progress * totalVW
    const offset = currentVX - playheadX
    return { W, ps, barW, barGap, step, numBars, totalVW, playheadX, dur, progress, currentVX, offset }
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio
    const W = canvas.width / dpr
    const H = canvas.height / dpr

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(dpr, dpr)

    const { a, b, enabled } = loopRef.current
    const dur = durationRef.current
    const ps = peaksRef.current
    const displayTime = (dragRef.current?.dragTime != null) ? dragRef.current.dragTime : timeRef.current
    const progress = dur > 0 ? displayTime / dur : 0

    const barW = 2, barGap = 1, step = barW + barGap
    const numBars = ps.length || Math.floor(W / step)
    const playheadX = W * PLAYHEAD_RATIO
    const totalVW = numBars * step
    const currentVX = progress * totalVW
    const offset = currentVX - playheadX

    // Loop region
    if (enabled && dur > 0) {
      const aVX = (Math.min(a, b) / dur) * totalVW
      const bVX = (Math.max(a, b) / dur) * totalVW
      const sx1 = aVX - offset
      const sx2 = bVX - offset
      if (sx2 > 0 && sx1 < W) {
        ctx.fillStyle = 'rgba(255,255,255,0.05)'
        ctx.fillRect(Math.max(0, sx1), 0, Math.min(W, sx2) - Math.max(0, sx1), H)
      }
    }

    // Bars — slightly dimmed when dragging to indicate scrub mode
    const pastColor = dragRef.current?.moved ? 'rgba(255,255,255,0.5)' : '#ffffff'
    for (let i = 0; i < numBars; i++) {
      const vx = i * step
      const sx = vx - offset
      if (sx > W) break
      if (sx + barW < 0) continue
      const peak = ps[i] ?? 0
      const barH = Math.max(2, peak * H * 0.85)
      const y = (H - barH) / 2
      ctx.fillStyle = vx < currentVX ? pastColor : '#2a2a2a'
      ctx.fillRect(sx, y, barW, barH)
    }

    // Loop markers
    if (dur > 0) {
      const drawMarker = (t, label) => {
        const vx = (t / dur) * totalVW
        const sx = vx - offset
        if (sx < -2 || sx > W + 2) return
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.fillRect(sx - 1, 0, 2, H)
        ctx.font = '9px monospace'
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.fillText(label, sx + 3, 10)
      }
      if (enabled || a > 0) drawMarker(a, 'A')
      if (enabled || b < dur) drawMarker(b, 'B')
    }

    // Fixed playhead cursor
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fillRect(playheadX, 0, 1, H)

    ctx.restore()
  }, [])

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      draw()
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [draw])

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

  // Convert drag delta to time (based on start position, not current display)
  function deltaToTime(dx) {
    const canvas = canvasRef.current
    if (!canvas || !dragRef.current) return null
    const W = canvas.offsetWidth
    const ps = peaksRef.current
    const step = 3
    const numBars = ps.length || Math.floor(W / step)
    const totalVW = numBars * step
    const dur = durationRef.current || 1
    const t = dragRef.current.startTime - (dx / totalVW) * dur
    return Math.max(0, Math.min(dur, t))
  }

  function tapTimeAt(screenX) {
    const canvas = canvasRef.current
    if (!canvas) return 0
    const W = canvas.offsetWidth
    const ps = peaksRef.current
    const step = 3
    const numBars = ps.length || Math.floor(W / step)
    const totalVW = numBars * step
    const playheadX = W * PLAYHEAD_RATIO
    const dur = durationRef.current || 1
    const displayTime = timeRef.current
    const currentVX = (displayTime / dur) * totalVW
    const offset = currentVX - playheadX
    return Math.max(0, Math.min(dur, ((screenX + offset) / totalVW) * dur))
  }

  function applyTap(screenX) {
    const t = tapTimeAt(screenX)
    if (clickMode === 'seek') {
      onSeek?.(t)
    } else if (clickMode === 'setA') {
      onSeek?.(null, t, Math.max(loopRef.current.b, t + 0.5))
      onClickDone?.()
    } else if (clickMode === 'setB') {
      onSeek?.(null, Math.min(loopRef.current.a, t - 0.5), t)
      onClickDone?.()
    }
  }

  // ── Mouse ────────────────────────────────────────────────────────────────
  function handleMouseDown(e) {
    dragRef.current = { startX: e.clientX, startTime: timeRef.current, moved: false, dragTime: null }
    const onMove = (ev) => {
      const dx = ev.clientX - dragRef.current.startX
      if (Math.abs(dx) > 4 && !dragRef.current.moved) {
        dragRef.current.moved = true
        onScrubStart?.()
      }
      if (!dragRef.current.moved) return
      dragRef.current.dragTime = deltaToTime(dx)
    }
    const onUp = () => {
      if (dragRef.current?.moved && dragRef.current.dragTime != null) {
        onScrubEnd?.(dragRef.current.dragTime)
      }
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function handleClick(e) {
    // Only fire on genuine taps (drag was handled in mouseup)
    if (dragRef.current !== null) return
    const rect = e.currentTarget.getBoundingClientRect()
    applyTap(e.clientX - rect.left)
  }

  // ── Touch ────────────────────────────────────────────────────────────────
  function handleTouchStart(e) {
    const t = e.touches[0]
    dragRef.current = { startX: t.clientX, startTime: timeRef.current, moved: false, dragTime: null }
  }

  function handleTouchMove(e) {
    if (!dragRef.current) return
    e.preventDefault()
    const t = e.touches[0]
    const dx = t.clientX - dragRef.current.startX
    if (Math.abs(dx) > 4 && !dragRef.current.moved) {
      dragRef.current.moved = true
      onScrubStart?.()
    }
    if (!dragRef.current.moved) return
    dragRef.current.dragTime = deltaToTime(dx)
  }

  function handleTouchEnd(e) {
    if (!dragRef.current) return
    if (dragRef.current.moved && dragRef.current.dragTime != null) {
      onScrubEnd?.(dragRef.current.dragTime)
    } else if (!dragRef.current.moved) {
      const rect = e.currentTarget.getBoundingClientRect()
      const t = e.changedTouches[0]
      applyTap(t.clientX - rect.left)
    }
    dragRef.current = null
  }

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="w-full h-full cursor-pointer"
      style={{ display: 'block', touchAction: 'none' }}
    />
  )
}
