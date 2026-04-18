import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://theartroom.gallery'
const IS_PROD = process.env.NEXT_PUBLIC_APP_ENV === 'production'

export default function robots(): MetadataRoute.Robots {
  // Staging and any other non-prod environment: block all crawlers.
  // We don't want search engines indexing test data, half-finished
  // artist profiles, or draft content.
  if (!IS_PROD) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/admin/', '/api/', '/reset-password'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
