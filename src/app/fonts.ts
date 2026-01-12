import { Lato, EB_Garamond, Geist, Roboto, Lora } from 'next/font/google'

// =============================================================================
// MAIN TYPOGRAPHY - Change these to swap fonts across the entire site
// =============================================================================

/**
 * Body font - Used for: text, navigation, forms, labels, lists, UI elements
 * Current: Lato
 * To change: Replace Lato with any Google font and update the variable name if needed
 */
export const bodyFont = Lato({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  variable: '--font-sans',
  display: 'swap',
})

/**
 * Heading font - Used for: h1, h2, h3, h4, h5, h6
 * Current: EB Garamond
 * To change: Replace EB_Garamond with any Google font
 */
export const headingFont = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-serif',
  display: 'swap',
})

/**
 * Dashboard font - Used for: all dashboard pages (artist, admin, settings, etc.)
 * Current: Geist
 * To change: Replace Geist with any Google font
 */
export const dashboardFont = Geist({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-dashboard',
  display: 'swap',
})

// =============================================================================
// 3D WALL VIEW FONTS - Used only in the exhibition editor
// =============================================================================

export const wallFont1 = Roboto({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-wall1',
  display: 'swap',
})

export const wallFont2 = Lora({
  subsets: ['latin'],
  variable: '--font-wall2',
  display: 'swap',
})
