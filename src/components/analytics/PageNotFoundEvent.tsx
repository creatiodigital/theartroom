'use client'

import { useEffect, useRef } from 'react'

import { track } from '@/lib/analytics/track'

/** GA4 `page_not_found` with the missing path and where the visitor came from (a broken link). */
export const PageNotFoundEvent = () => {
  // Once per page, even through React's development double effect.
  const sent = useRef(false)
  useEffect(() => {
    if (sent.current) return
    sent.current = true
    track('page_not_found', {
      missing_path: window.location.pathname,
      from: document.referrer ? new URL(document.referrer).host : undefined,
    })
  }, [])

  return null
}
