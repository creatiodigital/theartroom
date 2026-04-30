'use client'

import { useState } from 'react'

import type { SpecsSummary } from '@/lib/print-providers'

import styles from './SpecList.module.scss'

/**
 * Shared "what you selected" list. Renders one row per dimension the
 * buyer has configured, using each dimension's own buyer-facing label
 * + value as supplied by `summarizeConfig`.
 *
 * Provider-agnostic by construction: the rows are whatever the catalog
 * declared, in declaration order. A new dimension added to a provider's
 * catalog (e.g. when a glass option is added) shows up here automatically —
 * no edit to this file required.
 *
 * Collapsible: when the buyer has more than `visibleByDefault` rows
 * (default 4), the rest are hidden behind a "Show all selected
 * options" toggle so the summary panel doesn't push the CTA off-screen
 * on shorter viewports. configs commonly produce 9–10 rows.
 */
interface SpecListProps {
  specs: SpecsSummary
  className?: string
  visibleByDefault?: number
}

export const SpecList = ({ specs, className, visibleByDefault = 4 }: SpecListProps) => {
  const [expanded, setExpanded] = useState(false)
  if (specs.length === 0) return null

  const collapsible = specs.length > visibleByDefault
  const visible = expanded || !collapsible ? specs : specs.slice(0, visibleByDefault)

  return (
    <div className={`${styles.wrapper}${className ? ` ${className}` : ''}`}>
      <dl className={styles.specList}>
        {visible.map((row) => (
          <div key={row.id}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {collapsible && (
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <span>{expanded ? 'Show less' : 'Show all selected options'}</span>
          <span className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`} aria-hidden>
            ▾
          </span>
        </button>
      )}
    </div>
  )
}
