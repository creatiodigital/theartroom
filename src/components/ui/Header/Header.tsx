'use client'

import Link from 'next/link'

import { Navigation } from '@/components/ui/Navigation'

import styles from './Header.module.scss'

export const Header = () => {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.logo}>
          Lumen Gallery
        </Link>
        <Navigation />
      </div>
    </header>
  )
}
