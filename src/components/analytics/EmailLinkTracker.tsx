'use client'

import { useEffect } from 'react'

import { pageArea } from '@/lib/analytics/events'
import { track } from '@/lib/analytics/track'

/**
 * GA4 `email_click`: a press on any mailto link (Contact's "Write to us" and "Send a proposal",
 * the footer's address). GA4's automatic outbound-click tracking skips mailto, and email is the
 * site's only way to write to the gallery or submit as an artist. One listener for the whole site.
 */
export const EmailLinkTracker = () => {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a[href^="mailto:"]')
      if (!link) return
      track('email_click', {
        area: pageArea(window.location.pathname),
        link_text: link.textContent?.trim().slice(0, 60),
      })
    }
    document.addEventListener('click', onClick, { capture: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [])

  return null
}
