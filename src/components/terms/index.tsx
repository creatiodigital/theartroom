'use client'

import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import { Text } from '@/components/ui/Typography'

export const TermsPage = () => {
  return (
    <>
      <Header />
      <div className="page-content">
        <Text as="h1">Terms and Conditions</Text>
      </div>
      <Footer />
    </>
  )
}
