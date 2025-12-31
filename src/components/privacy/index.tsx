'use client'

import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import { Text } from '@/components/ui/Typography'

export const PrivacyPage = () => {
  return (
    <>
      <Header />
      <div className="page-content">
        <Text as="h1">Privacy Policy</Text>
      </div>
      <Footer />
    </>
  )
}
