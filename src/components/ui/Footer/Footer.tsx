'use client'

import Link from 'next/link'
import { Envelope } from '@phosphor-icons/react'

// The brand logos are the official glyphs from Simple Icons (CC0), kept as local
// SVGs.
import FacebookIcon from '@/icons/facebook.svg'
import InstagramIcon from '@/icons/instagram.svg'
import Monogram from '@/icons/monogram.svg'
import PinterestIcon from '@/icons/pinterest.svg'

import { Text } from '@/components/ui/Typography'

import { openCookieSettings } from '@/lib/consent'
import { CONTACT_EMAIL, SOCIAL_LINKS } from '@/lib/socialLinks'

import styles from './Footer.module.scss'

export const Footer = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.monogramRow}>
        <Link href="/" className={styles.monogramLink}>
          <Monogram className={styles.monogram} />
        </Link>
      </div>
      <div className={styles.footerInner}>
        <nav className={styles.links}>
          <Link href="/terms-and-conditions">Terms and Conditions</Link>
          <Link href="/terms-of-sale">Online Terms of Sale</Link>
          <Link href="/privacy-policy">Privacy Policy</Link>
          <Link href="/accessibility-policy">Accessibility Policy</Link>
          <button type="button" onClick={openCookieSettings} className={styles.cookieSettings}>
            Cookie Settings
          </button>
        </nav>
      </div>
      <div className={styles.socialBar}>
        <a href={SOCIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer">
          <InstagramIcon className={styles.brandIcon} aria-hidden />
          Instagram
        </a>
        <a href={SOCIAL_LINKS.facebook} target="_blank" rel="noopener noreferrer">
          <FacebookIcon className={styles.brandIcon} aria-hidden />
          Facebook
        </a>
        <a href={SOCIAL_LINKS.pinterest} target="_blank" rel="noopener noreferrer">
          <PinterestIcon className={styles.brandIcon} aria-hidden />
          Pinterest
        </a>
        <a href={`mailto:${CONTACT_EMAIL}`}>
          <Envelope size={18} weight="light" aria-hidden />
          Email
        </a>
      </div>
      <Text as="p" size="sm" font="serif" className={styles.copyright}>
        &copy; <em>{new Date().getFullYear()} The Art Room</em>
      </Text>
    </footer>
  )
}
