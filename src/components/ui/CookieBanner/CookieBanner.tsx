'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'

import styles from './CookieBanner.module.scss'

const STORAGE_KEY = 'cookie-consent'

export const CookieBanner = () => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) setVisible(true)
  }, [])

  const handleDismiss = () => {
    window.localStorage.setItem(STORAGE_KEY, 'dismissed')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className={styles.banner} role="region" aria-label="Cookie notice" aria-live="polite">
      <Text as="p" size="sm" className={styles.text}>
        <strong className={styles.brand}>The Art Room</strong> uses cookies to improve user
        experience.{' '}
        <Link href="/privacy-policy" className={styles.link}>
          Click to learn more
        </Link>
      </Text>
      <Button
        variant="ghost"
        size="smallSquared"
        icon="close"
        onClick={handleDismiss}
        aria-label="Dismiss cookie notice"
        className={styles.dismiss}
      />
    </div>
  )
}
