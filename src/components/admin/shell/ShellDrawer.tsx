'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from '@phosphor-icons/react'
import c from 'classnames'

import { Button } from '@/components/ui/Button'

import type { ShellTone } from './ShellFrame'

import styles from './ShellDrawer.module.scss'

type ShellDrawerProps = {
  tone: ShellTone
  /** The dialog's name: "Admin menu", "Artist menu". */
  label: string
  wordmark: ReactNode
  onClose: () => void
  children: ReactNode
}

/**
 * The phone menu: full screen, with the wordmark and a close button on top.
 * dashboard-phone-menu.dc.html.
 *
 * Focus moves to the close button on open. ShellFrame makes everything behind
 * the drawer `inert` while it is open, which is what keeps Tab inside it.
 */
export function ShellDrawer({ tone, label, wordmark, onClose, children }: ShellDrawerProps) {
  const closeWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    closeWrapRef.current?.querySelector('button')?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className={c(styles.drawer, styles[tone])}
    >
      <div className={styles.header}>
        {wordmark}
        <div ref={closeWrapRef} className={styles.closeWrap}>
          <Button
            variant="bare"
            font="dashboard"
            className={styles.close}
            aria-label="Close menu"
            onClick={onClose}
          >
            <X size={24} weight="light" aria-hidden />
          </Button>
        </div>
      </div>

      {children}
    </div>
  )
}
