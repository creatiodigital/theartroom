import type { ReactNode } from 'react'

import { bodyFont, headingFont, wallFont1, wallFont2 } from '@/app/fonts'
import StoreProvider from '@/app/storeProvider'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { ImpersonationBanner } from '@/components/ui/ImpersonationBanner'
import '@/styles/globals.scss'

type RootLayoutProps = {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${headingFont.variable} ${wallFont1.variable} ${wallFont2.variable}`}
    >
      <body>
        <AuthProvider>
          <StoreProvider>
            <ImpersonationBanner />
            <header></header>
            {children}
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
