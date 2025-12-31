'use client'

import Link from 'next/link'
import { Text } from '@/components/ui/Typography'

import { Navigation } from '@/components/ui/Navigation'

import styles from './Header.module.scss'

export const Header = () => {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.logo}>
          <Text as="h2" className={styles.logo}>Lumen Gallery</Text>
        </Link>
        <Navigation />
      </div>
    </header>
  )
}
