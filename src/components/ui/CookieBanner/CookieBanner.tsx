'use client'

import { useEffect, useState } from 'react'

import { ArrowLink } from '@/components/ui/ArrowLink'
import { Button } from '@/components/ui/Button'

import { track } from '@/lib/analytics/track'
import { getConsent, setConsent, OPEN_COOKIE_SETTINGS_EVENT } from '@/lib/consent'

import styles from './CookieBanner.module.scss'

export const CookieBanner = () => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Show on first visit (no decision stored yet).
    if (getConsent() === null) setVisible(true)

    // Allow the footer "Cookie settings" link to re-open the banner.
    const handleOpen = () => setVisible(true)
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, handleOpen)
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, handleOpen)
  }, [])

  const decide = (analytics: boolean) => {
    setConsent(analytics)
    // After the consent update, so an Accept is already measured in full. A Decline goes as a
    // cookieless ping, like everything else from that visitor.
    track('consent_choice', { choice: analytics ? 'accept' : 'decline' })
    setVisible(false)
  }

  if (!visible) return null

  // other-screens.md "Cookie banner" (designs/remaining-screens.dc.html): a white card bottom-left,
  // a serif heading, one sentence, Accept and Decline with equal weight, → Privacy policy.
  return (
    <div className={styles.banner} role="region" aria-label="Cookie consent">
      <p className={styles.heading}>Cookies</p>
      <p className={styles.text}>
        We use analytics cookies to understand how the gallery is explored and to improve it.
        Declining won’t affect your visit.
      </p>
      <div className={styles.actions}>
        <Button
          variant="bare"
          className={styles.choice}
          onClick={() => decide(true)}
          aria-label="Accept analytics cookies"
        >
          Accept
        </Button>
        <Button
          variant="bare"
          className={styles.choice}
          onClick={() => decide(false)}
          aria-label="Decline analytics cookies"
        >
          Decline
        </Button>
      </div>
      {/* Opens in a new tab so the policy is readable without dismissing this notice. */}
      <ArrowLink href="/privacy-policy" newTab size="small" className={styles.link}>
        Privacy policy
      </ArrowLink>
    </div>
  )
}
