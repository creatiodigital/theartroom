import { Lato, Crimson_Pro, Roboto, Lora } from 'next/font/google'

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
  variable: '--font-body',
  display: 'swap',
})

/**
 * Heading font - Used for: h1, h2, h3, h4, h5, h6
 * Current: Crimson Pro
 * To change: Replace Crimson_Pro with any Google font
 */
export const headingFont = Crimson_Pro({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-heading',
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
