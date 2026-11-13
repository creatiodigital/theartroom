'use client'

import { useId, useState, type ReactNode } from 'react'
import { CaretDown, type Icon } from '@phosphor-icons/react'
import c from 'classnames'

import { Button } from '@/components/ui/Button'

import { IconTile } from './IconTile'

import styles from './PanelSection.module.scss'

/** localStorage throws in some privacy modes: the section then simply isn't remembered. */
const readOpen = (key: string, fallback: boolean): boolean => {
  if (typeof window === 'undefined') return fallback
  try {
    const stored = localStorage.getItem(key)
    return stored === null ? fallback : stored === '1'
  } catch {
    return fallback
  }
}

const writeOpen = (key: string, open: boolean) => {
  try {
    localStorage.setItem(key, open ? '1' : '0')
  } catch {
    /* storage unavailable: not remembered */
  }
}

type PanelSectionProps = {
  title: string
  /** One line under the title, e.g. "Even light across the whole room". */
  sub?: string
  /** The 32px tile: white while closed, dark while open. Omitted for a room group. */
  icon?: Icon
  /** The section's main value (mono, on the head's right), only while closed, e.g. "40%". */
  summary?: string
  /**
   * The exact localStorage key the section's open state was remembered under before the
   * redesign (`ui/Section`: "section-{title slug}"; `ui/CollapsibleSection`: "collapsible-{key}"),
   * so a section an artist left open is still open. Stored as "1" / "0", as both did.
   */
  storageKey: string
  /** Before anything is remembered: today's default (ui/Section: closed). */
  defaultOpen?: boolean
  children: ReactNode
}

/**
 * A collapsible section card of a tool panel (editor3d.md "Sections", designs/editor-3d.dc.html):
 * the head is one button (tile, title and line, the value while closed, caret); the body is
 * rendered only while open, as before.
 */
export function PanelSection({
  title,
  sub,
  icon,
  summary,
  storageKey,
  defaultOpen = false,
  children,
}: PanelSectionProps) {
  const [open, setOpen] = useState(() => readOpen(storageKey, defaultOpen))
  const titleId = useId()

  const toggle = () => {
    const next = !open
    setOpen(next)
    writeOpen(storageKey, next)
  }

  return (
    <section className={c(styles.section, open && styles.open)} aria-labelledby={titleId}>
      <h3 className={styles.heading}>
        <Button
          variant="bare"
          font="dashboard"
          className={styles.head}
          aria-expanded={open}
          onClick={toggle}
        >
          {icon && <IconTile icon={icon} size={32} tint={open ? 'dark' : 'white'} />}
          <span className={styles.text}>
            <span id={titleId} className={styles.title}>
              {title}
            </span>
            {sub && <span className={styles.sub}>{sub}</span>}
          </span>
          {!open && summary && <span className={styles.summary}>{summary}</span>}
          <CaretDown size={14} weight="light" aria-hidden className={styles.caret} />
        </Button>
      </h3>
      {open && <div className={styles.body}>{children}</div>}
    </section>
  )
}
