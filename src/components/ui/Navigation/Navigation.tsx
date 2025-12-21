'use client'

import Link from 'next/link'

import styles from './Navigation.module.scss'

const navItems = [
  { label: 'Artists', href: '/artists' },
  { label: 'Exhibitions', href: '/exhibitions' },
  { label: 'Contact', href: '/contact' },
  { label: 'About', href: '/about' },
]

export const Navigation = () => {
  return (
    <nav className={styles.navigation}>
      <ul className={styles.navList}>
        {navItems.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className={styles.navLink}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
