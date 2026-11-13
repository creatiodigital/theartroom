'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { List, X } from '@phosphor-icons/react'

import { CartIcon } from '@/components/cart/CartIcon'
import { Button } from '@/components/ui/Button'
import Logo from '@/icons/logo.svg'
import styles from './Navigation.module.scss'

const navItems = [
  { label: 'Artists', href: '/artists' },
  { label: 'Exhibitions', href: '/exhibitions' },
  { label: 'Prints', href: '/prints' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
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
      {/* The cart sits in the always-visible bar, never inside the mobile menu:
          a buyer who added a print and wandered off must see it from any page,
          not only from /prints. Between the links and the hamburger so it
          reads [links][cart] on desktop and [cart][menu] on mobile. */}
      <div className={styles.bar}>
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

        <CartIcon />

        {/* Mobile Hamburger Button */}
        <Button
          variant="ghost"
          onClick={toggleMenu}
          className={styles.hamburgerButton}
          aria-label="Open menu"
          aria-expanded={isMenuOpen}
        >
          <List size={24} weight="light" aria-hidden />
        </Button>
      </div>

      {/* Mobile Menu Overlay */}
      <div className={`${styles.mobileOverlay} ${isMenuOpen ? styles.open : ''}`}>
        <div className={styles.mobileHeader}>
          <Link
            href="/"
            className={styles.mobileLogo}
            aria-label="The Art Room"
            onClick={() => setIsMenuOpen(false)}
          >
            <Logo aria-hidden />
          </Link>
          <Button
            variant="ghost"
            onClick={toggleMenu}
            className={styles.closeButton}
            aria-label="Close menu"
          >
            <X size={24} weight="light" aria-hidden />
          </Button>
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
