'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import styles from './Navigation.module.scss'

const navItems = [
  { label: 'Artists', href: '/artists' },
  { label: 'Exhibitions', href: '/exhibitions' },
  { label: 'Contact', href: '/contact' },
  { label: 'About', href: '/about' },
]

export const Navigation = () => {
  const pathname = usePathname()

  return (
    <nav className={styles.navigation}>
      <ul className={styles.navList}>
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`${styles.navLink} ${isActive ? styles.active : ''}`}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
