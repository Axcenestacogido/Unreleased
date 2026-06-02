import { useRef, useEffect, useCallback } from 'react'

export default function WaveCanvas({
  peaks = [],
  currentTime = 0,
  duration = 0,
  onSeek,
  loopA = 0,
  loopB = 0,
  loopEnabled = false,
  clickMode = 'seek', // 'seek' | 'setA' | 'setB'
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
    const W = canvas.width
    const H = canvas.height
    const { a, b, enabled } = loopRef.current
    const dur = durationRef.current
    const progress = dur > 0 ? timeRef.current / dur : 0
    const ps = peaksRef.current

    ctx.clearRect(0, 0, W, H)

    // Loop region
    if (enabled && dur > 0) {
      const x1 = (Math.min(a, b) / dur) * W
      const x2 = (Math.max(a, b) / dur) * W
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      ctx.fillRect(x1, 0, x2 - x1, H)
    }

    // Bars
    const barW = 2
    const barGap = 1
    const step = barW + barGap
    const numBars = ps.length || Math.floor(W / step)
    const progressX = progress * W

    for (let i = 0; i < numBars; i++) {
      const x = i * step
      if (x > W) break
      const peak = ps[i] ?? 0
      const barH = Math.max(2, peak * H * 0.85)
      const y = (H - barH) / 2
      const isPast = x < progressX
      ctx.fillStyle = isPast ? '#ffffff' : '#2a2a2a'
      ctx.fillRect(x, y, barW, barH)
    }

    // Loop markers
    if (dur > 0) {
      const drawMarker = (t, label) => {
        const x = (t / dur) * W
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.fillRect(x - 1, 0, 2, H)
        ctx.font = '9px monospace'
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.fillText(label, x + 3, 10)
      }
      if (enabled || a > 0) drawMarker(a, 'A')
      if (enabled || b < dur) drawMarker(b, 'B')
    }

    // Cursor
    if (progress > 0) {
      const cx = progress * W
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.fillRect(cx, 0, 1, H)
    }
  }, [])

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      const ctx = canvas.getContext('2d')
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      draw()
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [draw])

  // rAF loop for smooth progress
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

  function handleClick(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = x / rect.width
    const t = ratio * (durationRef.current || 1)

    if (clickMode === 'seek') {
      onSeek?.(t)
    } else if (clickMode === 'setA') {
      const b = Math.max(loopRef.current.b, t + 0.5)
      onSeek?.(null, t, b)
      onClickDone?.()
    } else if (clickMode === 'setB') {
      const a = Math.min(loopRef.current.a, t - 0.5)
      onSeek?.(null, a, t)
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
