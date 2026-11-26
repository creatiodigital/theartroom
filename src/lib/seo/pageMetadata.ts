import type { Metadata } from 'next'

export const SITE_NAME = 'The Art Room'

/**
 * What search engines and share cards say about the site as a whole (home page, the root
 * layout's default, the Organization data). Commerce leads with the artists (owner, 2026-11-18:
 * the site sells, it is not a showroom); the 3D rooms are the extra (launch positioning).
 */
export const SITE_DESCRIPTION =
  'Fine-art prints approved by the artist, from contemporary artists around the world. Discover their exhibitions online, and walk through them in 3D.'

/**
 * The SEO fields every public page shares (AR-193): its title, its description, its one address
 * and the share card.
 *
 * - `canonical`: the page's own address, so the artwork page's `?exhibition=` / `?artist=` /
 *   `?from=` (the grid the visitor came through) don't count as separate pages. `metadataBase`
 *   (root layout) makes it absolute.
 * - `openGraph`: Next replaces the root layout's `openGraph` whole when a page sets its own, so the
 *   site name, locale and type are repeated here rather than lost. The image comes from the
 *   route's `opengraph-image` file, which Next adds on top.
 */
export function publicPageMetadata({
  path,
  title,
  description,
}: {
  path: string
  title: string
  description: string
}): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'en_US',
      url: path,
      title,
      description,
    },
  }
}
