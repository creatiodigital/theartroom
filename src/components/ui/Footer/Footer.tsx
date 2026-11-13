'use client'

import Link from 'next/link'

// The brand logos are the official glyphs from Simple Icons (CC0), kept as local
// SVGs (README "Footer network icons": these, not Phosphor versions).
import FacebookIcon from '@/icons/facebook.svg'
import InstagramIcon from '@/icons/instagram.svg'
import Logo from '@/icons/logo.svg'
import PinterestIcon from '@/icons/pinterest.svg'

import { Button } from '@/components/ui/Button'

import { openCookieSettings } from '@/lib/consent'
import { CONTACT_EMAIL, SOCIAL_LINKS } from '@/lib/socialLinks'

import styles from './Footer.module.scss'

const SOCIAL = [
  { label: 'Instagram', href: SOCIAL_LINKS.instagram, Icon: InstagramIcon },
  { label: 'Facebook', href: SOCIAL_LINKS.facebook, Icon: FacebookIcon },
  { label: 'Pinterest', href: SOCIAL_LINKS.pinterest, Icon: PinterestIcon },
] as const

/**
 * The site footer (docs/public-redesign/home.md §8, owner 2026-11-11/13), the same on every screen,
 * all on the left with a hairline between each part: the wordmark, one line and the email; the
 * networks; the legal links (Cookie settings among them); the ©. No repeated page links.
 */
export const Footer = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <Link href="/" className={styles.logoLink} aria-label="The Art Room">
              <Logo className={styles.logo} aria-hidden />
            </Link>
            <p className={styles.tagline}>An online gallery for contemporary art.</p>
            <a href={`mailto:${CONTACT_EMAIL}`} className={styles.email}>
              {CONTACT_EMAIL}
            </a>
          </div>
          <ul className={styles.social}>
            {SOCIAL.map(({ label, href, Icon }) => (
              <li key={label}>
                <a href={href} target="_blank" rel="noopener noreferrer">
                  <Icon className={styles.brandIcon} aria-hidden />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.bottom}>
          <nav aria-label="Legal" className={styles.legal}>
            <Link href="/terms-and-conditions">Terms and conditions</Link>
            <Link href="/terms-of-sale">Online terms of sale</Link>
            <Link href="/privacy-policy">Privacy policy</Link>
            <Link href="/accessibility-policy">Accessibility policy</Link>
            <Button variant="bare" className={styles.cookieSettings} onClick={openCookieSettings}>
              Cookie settings
            </Button>
          </nav>
          <p className={styles.copyright}>&copy; {new Date().getFullYear()} The Art Room</p>
        </div>
      </div>
    </footer>
  )
}
