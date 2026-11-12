'use client'

import { useId, type ReactNode } from 'react'
import { CaretDown } from '@phosphor-icons/react'
import c from 'classnames'

import { Button } from '@/components/ui/Button'

import styles from './NumberedStep.module.scss'

/**
 * One step of the print configurator (docs/public-redesign/order-flow.md, components.md "Checkout
 * pieces": numbered accordion step): the step's number in a circle (a CSS counter on the steps
 * list), its title, and — closed — its choice as a grey line ("30 × 20 cm · 3 cm border"). As the
 * section it replaces, the content is rendered only while open.
 */
export function NumberedStep({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string
  /** The step's current choice, shown under the title while closed. */
  summary?: string | null
  open: boolean
  onToggle: (open: boolean) => void
  children: ReactNode
}) {
  const bodyId = useId()
  return (
    <section className={c(styles.step, open && styles.open)}>
      <Button
        variant="bare"
        className={styles.header}
        aria-expanded={open}
        aria-controls={open ? bodyId : undefined}
        onClick={() => onToggle(!open)}
      >
        <span className={styles.number} aria-hidden />
        <span className={styles.heading}>
          <span className={styles.title}>{title}</span>
          {!open && summary && <span className={styles.summary}>{summary}</span>}
        </span>
        <CaretDown size={16} weight="light" aria-hidden className={styles.caret} />
      </Button>
      {open && (
        <div id={bodyId} className={styles.body}>
          {children}
        </div>
      )}
    </section>
  )
}
