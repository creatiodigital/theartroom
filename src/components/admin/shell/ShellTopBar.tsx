'use client'

import type { ReactNode, Ref } from 'react'
import { List } from '@phosphor-icons/react'
import c from 'classnames'

import { Button } from '@/components/ui/Button'

import type { ShellMenuControls, ShellTone } from './ShellFrame'

import styles from './ShellTopBar.module.scss'

type ShellTopBarProps = Omit<ShellMenuControls, 'menuButtonRef'> & {
  /** Focus returns here when the drawer closes. */
  menuButtonRef: Ref<HTMLDivElement>
  tone: ShellTone
  wordmark: ReactNode
  /** Between the wordmark and the menu button (the studio's "Viewing as" pill). */
  accessory?: ReactNode
  /** The menu button's accessible name ("Open menu", "Open menu, 9 orders need attention"). */
  menuLabel: string
  /** Drawn on the menu button (the admin's Orders badge). */
  menuBadge?: ReactNode
}

/** The top bar under 900px: wordmark, optional accessory, menu button. */
export function ShellTopBar({
  tone,
  wordmark,
  accessory,
  menuLabel,
  menuBadge,
  menuOpen,
  onOpenMenu,
  menuButtonRef,
}: ShellTopBarProps) {
  return (
    <header className={c(styles.bar, styles[tone])}>
      {wordmark}
      {accessory}
      {/* Button takes no ref, so a wrapper carries it for the focus return. */}
      <div ref={menuButtonRef} className={styles.menuButtonWrap}>
        <Button
          variant="bare"
          font="dashboard"
          className={styles.menuButton}
          aria-label={menuLabel}
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          onClick={onOpenMenu}
        >
          <List size={24} weight="light" aria-hidden />
          {menuBadge}
        </Button>
      </div>
    </header>
  )
}
