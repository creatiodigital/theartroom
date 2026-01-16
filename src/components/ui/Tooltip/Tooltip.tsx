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

const Tooltip = ({ label, children, placement = 'top', offset = 8, fullWidth = false }: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [isMounted, setIsMounted] = useState(false)
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
    timerRef.current = setTimeout(() => {
      setPosition(calculatePosition())
      setIsVisible(true)
    }, 500)
  }

  const hideTooltip = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    setIsVisible(false)
  }

  const tooltipContent = isVisible && isMounted ? createPortal(
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
    document.body
  ) : null

  return (
    <div
      ref={wrapperRef}
      className={`${styles.tooltip} ${fullWidth ? styles.fullWidth : ''}`}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      {children}
      {tooltipContent}
    </div>
  )
}

export default Tooltip
