import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import {
  bodyFont,
  headingFont,
  dashboardFont,
  wallFont1,
  wallFont2,
  wallFont3,
  wallFont4,
  wallFont5,
  wallFont6,
} from '@/app/fonts'
import StoreProvider from '@/app/storeProvider'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { ImageProtection } from '@/components/providers/ImageProtection'
import { Analytics } from '@vercel/analytics/next'
import '@/styles/globals.scss'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://theartroom.gallery'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'The Art Room',
    template: 'The Art Room: %s',
  },
  description:
    'Explore curated virtual exhibitions in immersive 3D gallery spaces. Discover contemporary art beyond immediacy.',
  openGraph: {
    type: 'website',
    siteName: 'The Art Room',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
  },
}

type RootLayoutProps = {
  children: ReactNode
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'The Art Room',
  url: SITE_URL,
  logo: `${SITE_URL}/opengraph-image`,
  description:
    'Virtual exhibition space dedicated to showcasing contemporary art in immersive 3D environments.',
  sameAs: [],
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${headingFont.variable} ${dashboardFont.variable} ${wallFont1.variable} ${wallFont2.variable} ${wallFont3.variable} ${wallFont4.variable} ${wallFont5.variable} ${wallFont6.variable}`}
    >
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <AuthProvider>
          <StoreProvider>
            <ImageProtection />
            <header></header>
            {children}
          </StoreProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
