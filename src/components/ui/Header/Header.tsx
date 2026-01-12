'use client'

import Link from 'next/link'

import { Navigation } from '@/components/ui/Navigation'
import Logo from '@/icons/logo.svg'

import styles from './Header.module.scss'

export const Header = () => {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.logoLink}>
          <Logo className={styles.logo} />
        </Link>
        <Navigation />
      </div>
    </header>
  )
}
