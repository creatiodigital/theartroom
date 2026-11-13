'use client'

import { Pause, Play } from '@phosphor-icons/react'

import { Button } from '@/components/ui/Button'

import { useStorefrontSwitch } from './AdminShellContext'

import styles from './StorefrontSwitch.module.scss'

/**
 * The purchases kill switch, in the side menu so it is one click away on every
 * admin page. States: dashboard-states.dc.html §3. Both buttons open the
 * shell's confirmation; nothing flips without it.
 */
export function StorefrontSwitch() {
  const { paused, error, toggling, requestToggle, reload } = useStorefrontSwitch()

  let body
  if (paused === null && error) {
    // State unknown: never offer Pause / Resume on a guess.
    body = (
      <div className={styles.state}>
        <div className={styles.status}>
          <span className={`${styles.dot} ${styles.dot_unknown}`} />
          <span className={styles.statusText}>State unknown</span>
        </div>
        <span className={styles.error}>{error}</span>
        <Button
          variant="bare"
          font="dashboard"
          className={styles.retry}
          label="Retry"
          onClick={() => void reload()}
        />
      </div>
    )
  } else if (paused === null) {
    body = (
      <div className={styles.state}>
        <div className={styles.status}>
          <span className={`${styles.dot} ${styles.dot_loading}`} />
          <span className={styles.statusMuted}>Checking…</span>
        </div>
        <Button
          variant="bare"
          font="dashboard"
          className={styles.loadingButton}
          label="Loading…"
          disabled
        />
      </div>
    )
  } else if (paused) {
    body = (
      <div className={`${styles.state} ${styles.pausedBox}`}>
        <div className={styles.status}>
          <span className={`${styles.dot} ${styles.dot_paused}`} />
          <span className={styles.statusStrong}>Purchases paused</span>
        </div>
        <span className={styles.pausedNote}>The public site is read-only.</span>
        <Button
          variant="bare"
          font="dashboard"
          className={styles.resume}
          iconLeft={<Play size={16} weight="light" aria-hidden />}
          label="Resume purchases"
          disabled={toggling}
          onClick={requestToggle}
        />
        {error && <span className={styles.error}>{error}</span>}
      </div>
    )
  } else {
    body = (
      <div className={styles.state}>
        <div className={styles.status}>
          <span className={`${styles.dot} ${styles.dot_open}`} />
          <span className={styles.statusText}>Purchases open</span>
        </div>
        <Button
          variant="bare"
          font="dashboard"
          className={styles.pause}
          iconLeft={<Pause size={16} weight="light" aria-hidden />}
          label="Pause all purchases"
          disabled={toggling}
          onClick={requestToggle}
        />
        {error && <span className={styles.error}>{error}</span>}
      </div>
    )
  }

  return (
    <div className={styles.switch}>
      <span className={styles.heading}>Storefront</span>
      {body}
    </div>
  )
}
