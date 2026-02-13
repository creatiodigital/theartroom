'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'
import Logo from '@/icons/logo.svg'
import styles from './Navigation.module.scss'

const navItems = [
  { label: 'Artists', href: '/artists' },
  { label: 'Exhibitions', href: '/exhibitions' },
  { label: 'Contact', href: '/contact' },
  { label: 'About', href: '/about' },
]

export const Navigation = () => {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Close menu when route changes
  useEffect(() => {
    setIsMenuOpen(false)
  }, [pathname])

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMenuOpen])

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen)

  return (
    <>
      {/* Desktop Navigation */}
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

      {/* Mobile Hamburger Button */}
      <button
        className={styles.hamburgerButton}
        onClick={toggleMenu}
        aria-label="Open menu"
        aria-expanded={isMenuOpen}
      >
        <Menu size={24} strokeWidth={ICON_STROKE_WIDTH} />
      </button>

      {/* Mobile Menu Overlay */}
      <div className={`${styles.mobileOverlay} ${isMenuOpen ? styles.open : ''}`}>
        <div className={styles.mobileHeader}>
          <Link href="/" className={styles.mobileLogo} onClick={() => setIsMenuOpen(false)}>
            <Logo />
          </Link>
          <button className={styles.closeButton} onClick={toggleMenu} aria-label="Close menu">
            <X size={24} strokeWidth={ICON_STROKE_WIDTH} />
          </button>
        </div>
        <nav className={styles.mobileNav}>
          <ul className={styles.mobileNavList}>
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`${styles.mobileNavLink} ${isActive ? styles.active : ''}`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </>
  )
}
