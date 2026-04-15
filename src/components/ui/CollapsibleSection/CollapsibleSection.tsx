'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'

import styles from './CollapsibleSection.module.scss'

interface CollapsibleSectionProps {
  title: string
  children: ReactNode
  /** If provided, the component is controlled by the parent. */
  open?: boolean
  onToggle?: (open: boolean) => void
  /** Used only when the component is uncontrolled. */
  defaultOpen?: boolean
  className?: string
}

/**
 * Generic accordion section: header bar + collapsible body.
 * Distinct from any accordion used for exhibition wall panels.
 * Can be controlled (pass `open` + `onToggle`) or self-managed (`defaultOpen`).
 */
export const CollapsibleSection = ({
  title,
  children,
  open,
  onToggle,
  defaultOpen = false,
  className,
}: CollapsibleSectionProps) => {
  const isControlled = open !== undefined
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isOpen = isControlled ? open : internalOpen

  const handleToggle = () => {
    const next = !isOpen
    if (!isControlled) setInternalOpen(next)
    onToggle?.(next)
  }

  return (
    <section className={`${styles.section} ${isOpen ? styles.sectionOpen : ''} ${className ?? ''}`}>
      <button type="button" className={styles.header} onClick={handleToggle} aria-expanded={isOpen}>
        <span className={styles.title}>{title}</span>
        <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} aria-hidden>
          ▾
        </span>
      </button>
      {isOpen && <div className={styles.body}>{children}</div>}
    </section>
  )
}
