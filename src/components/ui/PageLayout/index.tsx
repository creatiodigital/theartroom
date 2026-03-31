'use client'
import { Header } from '@/components/ui/Header'
import { Footer } from '@/components/ui/Footer'
import { LoadingBar } from '@/components/ui/LoadingBar'

import styles from './PageLayout.module.scss'

type PageLayoutProps = {
  /** Content to render inside the layout */
  children?: React.ReactNode
  /** Show loading state instead of children */
  loading?: boolean
  /** Set to false to hide the header */
  showHeader?: boolean
  /** Set to false to hide the footer */
  showFooter?: boolean
  /** Additional className for the content wrapper */
  className?: string
}

export const PageLayout = ({
  children,
  loading = false,
  showHeader = true,
  showFooter = true,
  className = '',
}: PageLayoutProps) => {
  const contentClassName = [styles.content, className].filter(Boolean).join(' ')

  return (
    <>
      {showHeader && <Header />}
      <main id="main-content">
        <div className={contentClassName}>{loading ? <LoadingBar /> : children}</div>
      </main>
      {showFooter && <Footer />}
    </>
  )
}
