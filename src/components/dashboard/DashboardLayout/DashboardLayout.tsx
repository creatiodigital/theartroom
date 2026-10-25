'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'

import { Button } from '@/components/ui/Button'
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
  const isAdminArea = usePathname()?.startsWith('/admin') ?? false

  // Admin pages are always the real admin. Landing on one while an
  // impersonation is still on (Back button, another tab, a typed URL) ends it —
  // but only in a tab the admin is looking at: next-auth tells every open tab
  // when the session changes, and a hidden admin tab ending it would cancel the
  // impersonation the admin just started in another tab.
  const ending = useRef(false)
  useEffect(() => {
    if (!isAdminArea || !isImpersonating) return
    const endIfSeen = () => {
      if (document.visibilityState !== 'visible' || ending.current) return
      ending.current = true
      void stopImpersonation().finally(() => {
        ending.current = false
      })
    }
    endIfSeen()
    document.addEventListener('visibilitychange', endIfSeen)
    return () => document.removeEventListener('visibilitychange', endIfSeen)
  }, [isAdminArea, isImpersonating, stopImpersonation])

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
      {/* Impersonation Banner — never on admin pages, which end impersonations */}
      {isImpersonating && effectiveUser && !isAdminArea && (
        <div className={styles.impersonationBanner}>
          <Text font="dashboard" as="span">
            Viewing as <strong>{effectiveUser.name}</strong>
          </Text>
          <Button
            variant="ghost"
            font="dashboard"
            onClick={async () => {
              await stopImpersonation()
              router.push('/admin/dashboard')
            }}
            label="Stop Impersonating"
            className={styles.stopButton}
          />
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
      <div className={styles.content}>{children}</div>
    </div>
  )
}

export default DashboardLayout
