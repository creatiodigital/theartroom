'use client'

import { Button } from '@/components/ui/Button'
import { track } from '@/lib/analytics/track'
import { isMailto } from '@/lib/announcementButton'

import styles from './Announcement.module.scss'

/**
 * The announcement's optional button (docs/take-a-peek/README.md T9; designs/Announcement): the
 * site's black, square button, the label alone (owner, 2026-11-26: no icon). A `mailto:` link opens
 * the visitor's email app in place; an https:// address opens in a new tab, as the text's links do;
 * a site path navigates. Measured as announcement_cta { label }.
 */
export const AnnouncementButton = ({ label, href }: { label: string; href: string }) => {
  const mail = isMailto(href)
  const offSite = /^https:/i.test(href)
  return (
    <Button
      href={href}
      variant="primary"
      size="regularSquared"
      className={styles.button}
      newTab={offSite}
      prefetch={mail || offSite ? false : undefined}
      onLinkClick={() => track('announcement_cta', { label })}
    >
      {label}
    </Button>
  )
}
