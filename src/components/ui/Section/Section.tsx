'use client'

import { useState, useCallback, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'

import styles from './Section.module.scss'

const STORAGE_PREFIX = 'section-'

function getSectionKey(title: string): string {
  return `${STORAGE_PREFIX}${title.toLowerCase().replace(/\s+/g, '-')}`
}

function getStoredState(title: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback
  const stored = localStorage.getItem(getSectionKey(title))
  if (stored === null) return fallback
  return stored === '1'
}

interface SectionProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  collapsible?: boolean
  disabled?: boolean
}

export const Section = ({
  title,
  children,
  defaultOpen = false,
  collapsible = true,
  disabled,
}: SectionProps) => {
  const [isOpen, setIsOpen] = useState(() => getStoredState(title, defaultOpen))

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev
      localStorage.setItem(getSectionKey(title), next ? '1' : '0')
      return next
    })
  }, [title])

  const contentStyle = disabled ? { pointerEvents: 'none' as const, opacity: 0.5 } : undefined

  // For non-collapsible sections, always show content
  if (!collapsible) {
    return (
      <div className={styles.section}>
        <div className={`${styles.header} ${styles.nonCollapsible}`}>
          <span className={styles.title}>{title}</span>
        </div>
        <div className={styles.content} style={contentStyle}>
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.section}>
      <button type="button" className={styles.header} onClick={toggle} aria-expanded={isOpen}>
        <ChevronRight
          size={12}
          strokeWidth={ICON_STROKE_WIDTH}
          className={`${styles.chevron} ${isOpen ? styles.open : ''}`}
        />
        <span className={styles.title}>{title}</span>
      </button>
      {isOpen && (
        <div className={styles.content} style={contentStyle}>
          {children}
        </div>
      )}
    </div>
  )
}

export default Section
