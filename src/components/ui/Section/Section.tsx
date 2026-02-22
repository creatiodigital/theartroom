'use client'

import { useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'

import styles from './Section.module.scss'

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
  const [isOpen, setIsOpen] = useState(defaultOpen)

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
        onClick={() => setIsOpen((prev) => !prev)}
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
