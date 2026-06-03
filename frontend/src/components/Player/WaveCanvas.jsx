import { useRef, useEffect, useCallback } from 'react'

const PLAYHEAD_RATIO = 0.5

export default function WaveCanvas({
  peaks = [],
  currentTime = 0,
  duration = 0,
  onSeek,
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
  const dragRef = useRef(null) // { startX, startTime }

  peaksRef.current = peaks
  timeRef.current = currentTime
  durationRef.current = duration
  loopRef.current = { a: loopA, b: loopB, enabled: loopEnabled }

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
    const progress = dur > 0 ? timeRef.current / dur : 0
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
    const progress = dur > 0 ? timeRef.current / dur : 0

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

    // Bars
    for (let i = 0; i < numBars; i++) {
      const vx = i * step
      const sx = vx - offset
      if (sx > W) break
      if (sx + barW < 0) continue
      const peak = ps[i] ?? 0
      const barH = Math.max(2, peak * H * 0.85)
      const y = (H - barH) / 2
      ctx.fillStyle = vx < currentVX ? '#ffffff' : '#2a2a2a'
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

  function screenXToTime(screenX) {
    const m = getMetrics()
    if (!m) return 0
    const virtualX = screenX + m.offset
    return Math.max(0, Math.min(m.dur, (virtualX / m.totalVW) * m.dur))
  }

  function applySeek(screenX) {
    const t = screenXToTime(screenX)
    if (clickMode === 'seek') {
      onSeek?.(t)
    } else if (clickMode === 'setA') {
      const bVal = Math.max(loopRef.current.b, t + 0.5)
      onSeek?.(null, t, bVal)
      onClickDone?.()
    } else if (clickMode === 'setB') {
      const aVal = Math.min(loopRef.current.a, t - 0.5)
      onSeek?.(null, aVal, t)
      onClickDone?.()
    }
  }

  // Mouse drag
  function handleMouseDown(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    dragRef.current = { startX: e.clientX, startTime: timeRef.current, moved: false }
    const onMove = (ev) => {
      const dx = ev.clientX - dragRef.current.startX
      if (Math.abs(dx) > 4) dragRef.current.moved = true
      if (!dragRef.current.moved) return
      const m = getMetrics()
      if (!m) return
      const newTime = dragRef.current.startTime - (dx / m.totalVW) * m.dur
      onSeek?.(Math.max(0, Math.min(m.dur, newTime)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function handleClick(e) {
    if (dragRef.current?.moved) return
    const rect = e.currentTarget.getBoundingClientRect()
    applySeek(e.clientX - rect.left)
  }

  // Touch drag
  function handleTouchStart(e) {
    const t = e.touches[0]
    dragRef.current = { startX: t.clientX, startTime: timeRef.current, moved: false }
  }

  function handleTouchMove(e) {
    if (!dragRef.current) return
    e.preventDefault()
    const t = e.touches[0]
    const dx = t.clientX - dragRef.current.startX
    if (Math.abs(dx) > 4) dragRef.current.moved = true
    if (!dragRef.current.moved) return
    const m = getMetrics()
    if (!m) return
    const newTime = dragRef.current.startTime - (dx / m.totalVW) * m.dur
    onSeek?.(Math.max(0, Math.min(m.dur, newTime)))
  }

  function handleTouchEnd(e) {
    if (!dragRef.current?.moved) {
      const rect = e.currentTarget.getBoundingClientRect()
      const t = e.changedTouches[0]
      applySeek(t.clientX - rect.left)
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
