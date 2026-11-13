'use client'

import type { ShellMenuControls } from '@/components/admin/shell/ShellFrame'
import { ShellTopBar } from '@/components/admin/shell/ShellTopBar'
import { ShellWordmark } from '@/components/admin/shell/ShellWordmark'
import { Button } from '@/components/ui/Button'

import { STUDIO_HOME } from './studioNav'
import { useStudioImpersonation } from './useStudioShell'

import styles from './StudioTopBar.module.scss'

/**
 * The studio's light top bar under 900px (not drawn, questions.md Q94). While an
 * admin impersonates, a red "Viewing as {name}" pill opens the drawer, where
 * the card and Stop are.
 */
export function StudioTopBar({ menuOpen, onOpenMenu, menuButtonRef }: ShellMenuControls) {
  const impersonation = useStudioImpersonation()

  return (
    <ShellTopBar
      tone="light"
      wordmark={
        <ShellWordmark
          href={STUDIO_HOME}
          tag="Artist studio"
          tone="light"
          size="bar"
          layout="stacked"
        />
      }
      accessory={
        impersonation && (
          <span className={styles.pillWrap}>
            <Button
              variant="bare"
              font="dashboard"
              className={styles.pill}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              onClick={onOpenMenu}
            >
              <span className={styles.pillInner}>Viewing as {impersonation.name}</span>
            </Button>
          </span>
        )
      }
      menuLabel="Open menu"
      menuOpen={menuOpen}
      onOpenMenu={onOpenMenu}
      menuButtonRef={menuButtonRef}
    />
  )
}
