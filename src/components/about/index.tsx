'use client'

import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import { H1 } from '@/components/ui/Typography'

export const AboutPage = () => {
  return (
    <>
      <Header />
      <div className="page-content">
        <H1>About</H1>
      </div>
      <Footer />
    </>
  )
}
