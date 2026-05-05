'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'

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
      <Button
        variant="bare"
        onClick={handleToggle}
        className={styles.header}
        aria-expanded={isOpen}
      >
        <span className={styles.title}>{title}</span>
        <ChevronDown
          size={16}
          strokeWidth={ICON_STROKE_WIDTH}
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
          aria-hidden
        />
      </Button>
      {isOpen && <div className={styles.body}>{children}</div>}
    </section>
  )
}
