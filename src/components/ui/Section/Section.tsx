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
}

export const Section = ({
  title,
  children,
  defaultOpen = false,
  collapsible = true,
}: SectionProps) => {
  const [isOpen, setIsOpen] = useState(() => getStoredState(title, defaultOpen))

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev
      localStorage.setItem(getSectionKey(title), next ? '1' : '0')
      return next
    })
  }, [title])

  // For non-collapsible sections, always show content
  if (!collapsible) {
    return (
      <div className={styles.section}>
        <div className={`${styles.header} ${styles.nonCollapsible}`}>
          <span className={styles.title}>{title}</span>
        </div>
        <div className={styles.content}>
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.section}>
      <div
        className={styles.header}
        onClick={toggle}
      >
        <ChevronRight
          size={12}
          strokeWidth={ICON_STROKE_WIDTH}
          className={`${styles.chevron} ${isOpen ? styles.open : ''}`}
        />
        <span className={styles.title}>{title}</span>
      </div>
      {isOpen && (
        <div className={styles.content}>
          {children}
        </div>
      )}
    </div>
  )
}

export default Section
