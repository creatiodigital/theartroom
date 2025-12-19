import type { ReactNode } from 'react'

import { cabin, fraunces, roboto, lora } from '@/app/fonts'
import StoreProvider from '@/app/storeProvider'
import { AuthProvider } from '@/components/providers/AuthProvider'
import '@/styles/globals.scss'

type RootLayoutProps = {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      className={`${cabin.variable} ${fraunces.variable} ${roboto.variable} ${lora.variable}`}
    >
      <body>
        <AuthProvider>
          <StoreProvider>
            <header></header>
            {children}
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
