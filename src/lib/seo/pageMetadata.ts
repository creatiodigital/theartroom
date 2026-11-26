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
 * - `openGraph`, only with `ownShareImage` (artwork, artist and exhibition pages, which have their
 *   own `opengraph-image` file). Next replaces the layout's `openGraph` whole when a page sets one,
 *   and with it the root's monogram card (app/opengraph-image): the home page and /prints lost
 *   their share image that way. Every other page inherits the layout's, and Next fills in its title
 *   and description. The site name, locale and type are repeated here rather than lost.
 */
export function publicPageMetadata({
  path,
  title,
  description,
  ownShareImage = false,
}: {
  path: string
  title: string
  description: string
  /** The route has its own `opengraph-image` file. */
  ownShareImage?: boolean
}): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    ...(ownShareImage && {
      openGraph: {
        type: 'website',
        siteName: SITE_NAME,
        locale: 'en_US',
        url: path,
        title,
        description,
      },
    }),
  }
}
