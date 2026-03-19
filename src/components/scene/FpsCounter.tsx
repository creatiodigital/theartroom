import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'

/**
 * Lightweight FPS counter that works with frameloop="demand".
 * Unlike drei's <Stats />, this does NOT force continuous rendering.
 * It only counts frames that are actually rendered.
 */
export function FpsCounter() {
  const frames = useRef(0)
  const lastTime = useRef(performance.now())
  const domRef = useRef<HTMLDivElement | null>(null)

  // Create and mount a DOM overlay
  useEffect(() => {
    const div = document.createElement('div')
    div.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      z-index: 9999;
      padding: 4px 8px;
      background: rgba(0, 0, 0, 0.85);
      color: #0ff;
      font: bold 13px monospace;
      pointer-events: none;
    `
    div.textContent = '-- FPS'
    document.body.appendChild(div)
    domRef.current = div

    return () => {
      document.body.removeChild(div)
      domRef.current = null
    }
  }, [])

  // Count rendered frames (only runs when a frame is actually rendered)
  useFrame(() => {
    frames.current++
    const now = performance.now()
    const elapsed = now - lastTime.current

    if (elapsed >= 1000) {
      const fps = Math.round((frames.current * 1000) / elapsed)
      if (domRef.current) {
        domRef.current.textContent = `${fps} FPS`
      }
      frames.current = 0
      lastTime.current = now
    }
  })

  return null
}
