'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Prevents right-click context menu on images for client-facing pages.
 * Dashboard and admin pages are excluded from this protection.
 */
export const ImageProtection = () => {
  const pathname = usePathname()

  useEffect(() => {
    // Skip protection for dashboard and admin pages
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
      return
    }

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Block right-click on images and canvas elements
      if (target.tagName === 'IMG' || target.tagName === 'CANVAS') {
        e.preventDefault()
      }
    }

    document.addEventListener('contextmenu', handleContextMenu)
    return () => document.removeEventListener('contextmenu', handleContextMenu)
  }, [pathname])

  return null
}
