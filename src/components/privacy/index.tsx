'use client'

import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import { StaticPageContent } from '@/components/ui/StaticPageContent'

export const PrivacyPage = () => {
  return (
    <>
      <Header />
      <div className="page-content">
        <StaticPageContent slug="privacy" />
      </div>
      <Footer />
    </>
  )
}
