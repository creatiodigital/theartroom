'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useDispatch } from 'react-redux'

import { setPointerOnRoom } from '@/redux/slices/floorSlice'

import { FloorView } from './FloorView'
import styles from './FloorView.module.scss'

const MIN_PLAN = 320
const MIN_THREE = 280

/**
 * Lays the Floor view out around the editor's own 3D canvas (`children`), which stays mounted
 * whether the view is open or not: open, the canvas becomes the live 3D beside the plan; closed,
 * it is the full-screen room as before. The divider between plan and 3D resizes them.
 */
export function FloorFrame({ active, children }: { active: boolean; children: ReactNode }) {
  const [planW, setPlanW] = useState<number | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const dispatch = useDispatch()

  useEffect(() => {
    if (!active) return
    const onMove = (event: PointerEvent) => {
      if (!dragging.current || !frameRef.current) return
      const plan = frameRef.current.querySelector<HTMLElement>('[data-floor-plan]')
      const three = frameRef.current.querySelector<HTMLElement>('[data-floor-three]')
      if (!plan || !three) return
      const left = plan.getBoundingClientRect().left
      const max = three.getBoundingClientRect().right - MIN_THREE - left
      setPlanW(Math.max(MIN_PLAN, Math.min(max, event.clientX - left)))
    }
    const onUp = () => {
      dragging.current = false
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [active])

  return (
    <div
      ref={frameRef}
      className={active ? styles.frame : undefined}
      style={active && planW ? ({ '--plan-w': `${planW}px` } as CSSProperties) : undefined}
    >
      {active ? <FloorView /> : null}
      {/* The mouse over the live 3D: the arrows and WASD walk the room (owner, 2026-11-25). */}
      <div
        className={active ? styles.threeSlot : undefined}
        data-floor-three={active || undefined}
        onPointerEnter={active ? () => dispatch(setPointerOnRoom(true)) : undefined}
        onPointerLeave={active ? () => dispatch(setPointerOnRoom(false)) : undefined}
      >
        {children}
      </div>
      {active ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize plan and 3D"
          className={styles.split}
          data-panel-overlay
          onPointerDown={(event) => {
            dragging.current = true
            event.preventDefault()
          }}
        >
          <span aria-hidden />
        </div>
      ) : null}
    </div>
  )
}
