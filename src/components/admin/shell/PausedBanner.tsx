'use client'

import { Pause } from '@phosphor-icons/react'

import { Button } from '@/components/ui/Button'

import { useStorefrontSwitch } from './AdminShellContext'

import styles from './PausedBanner.module.scss'

/** Red bar at the top of every admin page while purchases are paused. */
export function PausedBanner() {
  const { paused, error, toggling, requestToggle } = useStorefrontSwitch()
  if (paused !== true) return null

  return (
    <div role="status" className={styles.banner}>
      <Pause size={18} weight="light" aria-hidden />
      <span className={styles.text}>
        <strong>Purchases are paused.</strong> The public site is read-only and new payments are
        refused. Orders already placed are not affected.
      </span>
      <Button
        variant="bare"
        font="dashboard"
        className={styles.resume}
        label="Resume purchases"
        disabled={toggling}
        onClick={requestToggle}
      />
      {/* A failed resume shows here too: on a phone the side menu (and its
          switch) is hidden, so this is the only place the admin would see it. */}
      {error && <span className={styles.error}>{error}</span>}
    </div>
  )
}
