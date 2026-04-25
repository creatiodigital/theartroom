'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import styles from './HelpTooltip.module.scss'

type Placement = 'top' | 'right' | 'bottom' | 'left'

type HelpTooltipProps = {
  /** Rich descriptive content shown inside the help panel. */
  content: ReactNode
  /** The trigger — whatever element the user hovers to open the panel. */
  children: ReactNode
  /** Optional visual (illustration, icon, product shot) shown on the left. */
  image?: ReactNode
  placement?: Placement
  offset?: number
  /** Extra class on the trigger wrapper — useful when the default
   *  inline-flex doesn't fit (e.g. full-width dropdown option rows). */
  className?: string
}

const SHOW_DELAY_MS = 250
const HIDE_DELAY_MS = 120

const HelpTooltip = ({
  content,
  children,
  image,
  placement = 'right',
  offset = 12,
  className,
}: HelpTooltipProps) => {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [isMounted, setIsMounted] = useState(false)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])

  const calculatePosition = () => {
    if (!wrapperRef.current) return { top: 0, left: 0 }
    const rect = wrapperRef.current.getBoundingClientRect()
    switch (placement) {
      case 'top':
        return { top: rect.top - offset, left: rect.left + rect.width / 2 }
      case 'bottom':
        return { top: rect.bottom + offset, left: rect.left + rect.width / 2 }
      case 'left':
        return { top: rect.top + rect.height / 2, left: rect.left - offset }
      case 'right':
      default:
        return { top: rect.top + rect.height / 2, left: rect.right + offset }
    }
  }

  const cancelHide = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }

  const scheduleShow = () => {
    cancelHide()
    if (isVisible) return
    showTimerRef.current = setTimeout(() => {
      setPosition(calculatePosition())
      setIsVisible(true)
    }, SHOW_DELAY_MS)
  }

  const scheduleHide = () => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current)
      showTimerRef.current = null
    }
    hideTimerRef.current = setTimeout(() => setIsVisible(false), HIDE_DELAY_MS)
  }

  useEffect(() => {
    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  const panel =
    isVisible && isMounted
      ? createPortal(
          <div
            className={`${styles.panel} ${styles[placement]}`}
            style={{ position: 'fixed', top: position.top, left: position.left }}
            onMouseEnter={cancelHide}
            onMouseLeave={scheduleHide}
            role="tooltip"
          >
            {image && <div className={styles.image}>{image}</div>}
            <div className={styles.body}>{content}</div>
          </div>,
          document.body,
        )
      : null

  return (
    <div
      ref={wrapperRef}
      className={`${styles.wrapper} ${className ?? ''}`}
      onMouseEnter={scheduleShow}
      onMouseLeave={scheduleHide}
    >
      {children}
      {panel}
    </div>
  )
}

export default HelpTooltip
