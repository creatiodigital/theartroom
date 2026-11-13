'use client'

import { ShellDrawer } from '@/components/admin/shell/ShellDrawer'
import { ShellWordmark } from '@/components/admin/shell/ShellWordmark'

import { StudioMenuBody } from './StudioMenuBody'

import styles from './StudioMenuBody.module.scss'

type StudioMenuDrawerProps = {
  onClose: () => void
}

/** The studio's phone menu: full screen, white, the card on top (questions.md Q94). */
export function StudioMenuDrawer({ onClose }: StudioMenuDrawerProps) {
  return (
    <ShellDrawer
      tone="light"
      label="Artist menu"
      wordmark={<ShellWordmark tag="Artist studio" tone="light" size="bar" layout="stacked" />}
      onClose={onClose}
    >
      <nav aria-label="Artist" className={styles.drawerNav}>
        <StudioMenuBody layout="drawer" onNavigate={onClose} />
      </nav>
    </ShellDrawer>
  )
}
