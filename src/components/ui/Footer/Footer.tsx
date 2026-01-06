'use client'

import Link from 'next/link'
import { Text } from '@/components/ui/Typography'

import styles from './Footer.module.scss'

export const Footer = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <Text as="h3" className={styles.brand}>Lumen Gallery</Text>
        <nav className={styles.links}>
          <Link href="/terms-and-conditions">Terms and Conditions</Link>
          <Link href="/privacy-policy">Privacy Policy</Link>
          <Link href="/accessibility-policy">Accessibility Policy</Link>
        </nav>
        <span className={styles.copyright}>© 2025 Lumen Gallery</span>
      </div>
    </footer>
  )
}
