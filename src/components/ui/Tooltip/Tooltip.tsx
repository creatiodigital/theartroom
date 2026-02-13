'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import styles from './Tooltip.module.scss'

type Placement = 'top' | 'right' | 'bottom' | 'left'

type TooltipProps = {
  label: string
  children: ReactNode
  placement?: Placement
  offset?: number
  fullWidth?: boolean
}

const Tooltip = ({
  label,
  children,
  placement = 'top',
  offset = 8,
  fullWidth = false,
}: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [isMounted, setIsMounted] = useState(false)
  const [isMouseDown, setIsMouseDown] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])

  const calculatePosition = () => {
    if (!wrapperRef.current) return { top: 0, left: 0 }

    const rect = wrapperRef.current.getBoundingClientRect()

    switch (placement) {
      case 'top':
        return {
          top: rect.top - offset,
          left: rect.left + rect.width / 2,
        }
      case 'bottom':
        return {
          top: rect.bottom + offset,
          left: rect.left + rect.width / 2,
        }
      case 'left':
        return {
          top: rect.top + rect.height / 2,
          left: rect.left - offset,
        }
      case 'right':
        return {
          top: rect.top + rect.height / 2,
          left: rect.right + offset,
        }
      default:
        return { top: 0, left: 0 }
    }
  }

  const showTooltip = () => {
    // Don't show tooltip if mouse is pressed (dragging/resizing)
    if (isMouseDown) return
    timerRef.current = setTimeout(() => {
      if (!isMouseDown) {
        setPosition(calculatePosition())
        setIsVisible(true)
      }
    }, 1000)
  }

  const hideTooltip = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    setIsVisible(false)
  }

  // Track global mouse state to hide tooltip during drag operations
  useEffect(() => {
    const handleGlobalMouseDown = () => {
      setIsMouseDown(true)
      hideTooltip()
    }
    const handleGlobalMouseUp = () => {
      setIsMouseDown(false)
    }
    document.addEventListener('mousedown', handleGlobalMouseDown)
    document.addEventListener('mouseup', handleGlobalMouseUp)
    return () => {
      document.removeEventListener('mousedown', handleGlobalMouseDown)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [])

  const tooltipContent =
    isVisible && isMounted && !isMouseDown
      ? createPortal(
          <div
            className={`${styles.content} ${styles[placement]}`}
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
            }}
          >
            {label}
          </div>,
          document.body,
        )
      : null

  return (
    <div
      ref={wrapperRef}
      className={`${styles.tooltip} ${fullWidth ? styles.fullWidth : ''}`}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onMouseDown={hideTooltip}
    >
      {children}
      {tooltipContent}
    </div>
  )
}

export default Tooltip
