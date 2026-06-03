import { useRef, useEffect, useCallback } from 'react'

const PLAYHEAD_RATIO = 0.3 // fixed cursor at 30% from left

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

  peaksRef.current = peaks
  timeRef.current = currentTime
  durationRef.current = duration
  loopRef.current = { a: loopA, b: loopB, enabled: loopEnabled }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width / window.devicePixelRatio
    const H = canvas.height / window.devicePixelRatio
    const dpr = window.devicePixelRatio

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(dpr, dpr)

    const { a, b, enabled } = loopRef.current
    const dur = durationRef.current
    const progress = dur > 0 ? timeRef.current / dur : 0
    const ps = peaksRef.current

    const barW = 2
    const barGap = 1
    const step = barW + barGap
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
        ctx.fillText(label, sx + 3, 10)
      }
      if (enabled || a > 0) drawMarker(a, 'A')
      if (enabled || b < dur) drawMarker(b, 'B')
    }

    // Fixed playhead cursor
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
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
    return () => {
      running = false
      cancelAnimationFrame(animRef.current)
    }
  }, [draw])

  function screenXToTime(screenX) {
    const canvas = canvasRef.current
    if (!canvas) return 0
    const W = canvas.offsetWidth
    const dur = durationRef.current || 1
    const ps = peaksRef.current
    const barW = 2
    const barGap = 1
    const step = barW + barGap
    const numBars = ps.length || Math.floor(W / step)
    const playheadX = W * PLAYHEAD_RATIO
    const totalVW = numBars * step
    const progress = dur > 0 ? timeRef.current / dur : 0
    const currentVX = progress * totalVW
    const offset = currentVX - playheadX
    const virtualX = screenX + offset
    return Math.max(0, Math.min(dur, (virtualX / totalVW) * dur))
  }

  function handleClick(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const t = screenXToTime(x)

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

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className="w-full h-full cursor-pointer"
      style={{ display: 'block' }}
    />
  )
}
