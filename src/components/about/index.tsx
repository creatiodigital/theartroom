'use client'

import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'

export const AboutPage = () => {
  return (
    <>
      <Header />
      <div style={{ padding: '2rem', minHeight: '60vh' }}>
        <h1>About</h1>
      </div>
      <Footer />
    </>
  )
}
