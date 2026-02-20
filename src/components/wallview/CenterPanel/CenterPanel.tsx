'use client'

import { useEffect, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { useDeselectArtwork } from '@/components/wallview/hooks/useDeselectArtwork'
import { Wall } from '@/components/wallview/Wall/Wall'
import { Text } from '@/components/ui/Typography'
import { zoomAtPoint, setPanPosition } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'

import styles from './CenterPanel.module.scss'

export const CenterPanel = () => {
  const dispatch = useDispatch()
  const containerRef = useRef<HTMLDivElement>(null)
  const panPosition = useSelector((state: RootState) => state.wallView.panPosition)
  const scaleFactor = useSelector((state: RootState) => state.wallView.scaleFactor)
  const { handleDeselect } = useDeselectArtwork()

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    el.style.overscrollBehavior = 'contain'
    el.style.touchAction = 'none'

    // Momentum / inertia guard for Magic Mouse and trackpads.
    // After 120 ms of silence we assume the gesture ended; any further
    // events are OS-generated momentum and should be ignored until a
    // fresh gap resets the flag.
    let zoomCooldownId: ReturnType<typeof setTimeout> | null = null
    let isMomentum = false

    const handleWheel = (e: WheelEvent) => {
      if (e.cancelable) e.preventDefault()

      if (e.metaKey || e.ctrlKey) {
        // Block momentum events
        if (isMomentum) return

        // Reset the cooldown on every real event
        if (zoomCooldownId) clearTimeout(zoomCooldownId)
        zoomCooldownId = setTimeout(() => {
          // Gesture ended – any further wheel events are momentum
          isMomentum = true
          // Re-allow after a full stop (another gap)
          zoomCooldownId = setTimeout(() => {
            isMomentum = false
          }, 200)
        }, 120)

        const rect = el.getBoundingClientRect()
        const cursorXRatio = (e.clientX - rect.left) / rect.width
        const cursorYRatio = (e.clientY - rect.top) / rect.height

        dispatch(
          zoomAtPoint({
            direction: e.deltaY < 0 ? 'in' : 'out',
            cursorXRatio,
            cursorYRatio,
            containerWidth: rect.width,
            containerHeight: rect.height,
          }),
        )
        return
      }

      const scrollSpeedFactor = 1.2
      const deltaX = e.deltaX * scrollSpeedFactor
      const deltaY = e.deltaY * scrollSpeedFactor

      // Normalize against wrapper size (50000px) so panning is consistent
      const wrapperSize = 50000

      dispatch(
        setPanPosition({
          deltaX: -deltaX / wrapperSize,
          deltaY: -deltaY / wrapperSize,
        }),
      )
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', handleWheel)
      if (zoomCooldownId) clearTimeout(zoomCooldownId)
    }
  }, [dispatch])

  return (
    <div ref={containerRef} className={styles.panel}>
      <div className={styles.scaleIndicator}>
        <Text font="dashboard" as="span" size="sm">
          Zoom: {Math.round(scaleFactor * 100)}%
        </Text>
      </div>
      <div
        id="wallWrapper"
        className={styles.wrapper}
        onClick={handleDeselect}
        style={{
          transform: `translate(${panPosition.x}%, ${panPosition.y}%) scale(${scaleFactor || 1})`,
          '--scale-factor': String(scaleFactor || 1),
        } as React.CSSProperties}
      >
        <Wall />
      </div>
    </div>
  )
}

export default CenterPanel
