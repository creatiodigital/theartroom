'use client'

import Link from 'next/link'

import styles from './Navigation.module.scss'

const navItems = [
  { label: 'Artists', href: '/artists' },
  { label: 'Exhibitions', href: '/exhibitions' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
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
