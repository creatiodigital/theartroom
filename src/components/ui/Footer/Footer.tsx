'use client'

import Link from 'next/link'

import Logo from '@/icons/logo.svg'

import styles from './Footer.module.scss'

export const Footer = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <Link href="/" className={styles.logoLink}>
          <Logo className={styles.logo} />
        </Link>
        <nav className={styles.links}>
          <Link href="/terms-and-conditions">Terms and Conditions</Link>
          <Link href="/privacy-policy">Privacy Policy</Link>
          <Link href="/accessibility-policy">Accessibility Policy</Link>
        </nav>
        <span className={styles.copyright}>© 2025 The Art Room</span>
      </div>
    </footer>
  )
}
