import type { ReactNode } from 'react'

import { bodyFont, headingFont, dashboardFont, wallFont1, wallFont2, wallFont3, wallFont4, wallFont5 } from '@/app/fonts'
import StoreProvider from '@/app/storeProvider'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { ImageProtection } from '@/components/providers/ImageProtection'
import '@/styles/globals.scss'

type RootLayoutProps = {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${headingFont.variable} ${dashboardFont.variable} ${wallFont1.variable} ${wallFont2.variable} ${wallFont3.variable} ${wallFont4.variable} ${wallFont5.variable}`}
    >
      <body>
        <AuthProvider>
          <StoreProvider>
            <ImageProtection />
            <header></header>
            {children}
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
