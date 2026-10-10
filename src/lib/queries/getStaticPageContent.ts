import { unstable_cache } from 'next/cache'

import prisma from '@/lib/prisma'

const TITLES: Record<string, string> = {
  about: 'About Us',
  terms: 'Terms and Conditions',
  privacy: 'Privacy Policy',
  accessibility: 'Accessibility Policy',
  'sale-terms': 'Online Terms of Sale',
  prints: 'Prints',
}

const formatSlugToTitle = (slug: string): string =>
  TITLES[slug] || slug.charAt(0).toUpperCase() + slug.slice(1)

/**
 * Reads a CMS page row by slug. Mirrors the upsert-on-miss behavior of
 * /api/pages/[slug] so first-load of a never-edited page returns a
 * stub instead of null. Cache tag matches that route so admin edits
 * (which call `revalidateTag('page-${slug}', { expire: 0 })`) invalidate this cache too.
 */
export const getStaticPageContent = (slug: string) =>
  unstable_cache(
    async () => {
      let page = await prisma.pageContent.findUnique({ where: { slug } })
      if (!page) {
        page = await prisma.pageContent.create({
          data: {
            slug,
            title: formatSlugToTitle(slug),
            content: '<p>Content coming soon...</p>',
          },
        })
      }
      return page
    },
    // v2: entries written before saves revalidated this tag (they never did —
    // see PUT /api/pages/[slug]) can be up to a day stale. A new key makes the
    // deploy that fixes the save skip them, instead of waiting out the 24h.
    [`static-page-content-v2-${slug}`],
    { tags: [`page-${slug}`], revalidate: 86400 },
  )()
