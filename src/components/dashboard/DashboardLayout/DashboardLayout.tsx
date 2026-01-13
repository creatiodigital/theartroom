'use client'

import { useEffect, type ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { LoadingBar } from '@/components/ui/LoadingBar'
import { Logout } from '@/components/ui/Logout'
import { Text } from '@/components/ui/Typography'
import { useEffectiveUser } from '@/hooks/useEffectiveUser'

import styles from './DashboardLayout.module.scss'

type DashboardLayoutProps = {
  children: ReactNode
  backLink?: string
  backLabel?: string
  headerActions?: ReactNode
}

export const DashboardLayout = ({
  children,
  backLink,
  backLabel = '← Back to Dashboard',
  headerActions,
}: DashboardLayoutProps) => {
  const { status: sessionStatus } = useSession()
  const { effectiveUser, isImpersonating, stopImpersonation } = useEffectiveUser()
  const router = useRouter()

  // Redirect to home if not logged in
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    }
  }, [sessionStatus, router])

  // Show loading while checking session
  if (sessionStatus === 'loading') {
    return (
      <div className={styles.page}>
        <LoadingBar />
      </div>
    )
  }

  // Don't render if unauthenticated (redirect pending)
  if (sessionStatus === 'unauthenticated') {
    return null
  }

  return (
    <div className={styles.page}>
      {/* Impersonation Banner */}
      {isImpersonating && effectiveUser && (
        <div className={styles.impersonationBanner}>
          <Text font="dashboard" as="span">
            Viewing as <strong>{effectiveUser.name}</strong>
          </Text>
          <button
            type="button"
            className={styles.stopButton}
            onClick={() => {
              stopImpersonation()
              router.push('/admin/dashboard')
            }}
          >
            Stop Impersonating
          </button>
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {backLink && (
            <Link href={backLink} className={styles.backLink}>
              {backLabel}
            </Link>
          )}
        </div>
        <div className={styles.headerRight}>
          {headerActions}
          <Logout />
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.content}>
        {children}
      </div>
    </div>
  )
}

export default DashboardLayout
