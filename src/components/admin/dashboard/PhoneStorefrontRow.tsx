'use client'

import c from 'classnames'

import { useStorefrontSwitch } from '@/components/admin/shell'
import { Button } from '@/components/ui/Button'

import styles from './PhoneStorefrontRow.module.scss'

/**
 * The purchases switch on phones, where the side menu (and its switch) is
 * hidden: a compact row at the top of the dashboard (dashboard-phone.dc.html).
 * Same shared state and confirmation as the menu switch; hidden from 900px.
 */
export function PhoneStorefrontRow() {
  const { paused, error, toggling, requestToggle, reload } = useStorefrontSwitch()

  let dot: string
  let label: string
  let action = null
  if (paused === null && error) {
    dot = styles.dotUnknown
    label = 'State unknown'
    action = (
      <Button
        variant="bare"
        font="dashboard"
        className={styles.action}
        label="Retry"
        onClick={() => void reload()}
      />
    )
  } else if (paused === null) {
    dot = styles.dotLoading
    label = 'Checking…'
  } else if (paused) {
    dot = styles.dotPaused
    label = 'Purchases paused'
    action = (
      <Button
        variant="bare"
        font="dashboard"
        className={c(styles.action, styles.resume)}
        label="Resume"
        disabled={toggling}
        onClick={requestToggle}
      />
    )
  } else {
    dot = styles.dotOpen
    label = 'Purchases open'
    action = (
      <Button
        variant="bare"
        font="dashboard"
        className={c(styles.action, styles.pause)}
        label="Pause"
        disabled={toggling}
        onClick={requestToggle}
      />
    )
  }

  return (
    <div className={styles.row}>
      <div className={styles.main}>
        <span aria-hidden className={c(styles.dot, dot)} />
        <span className={styles.label}>{label}</span>
        {action}
      </div>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  )
}
