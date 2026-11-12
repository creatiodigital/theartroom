'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { LoadingBar } from '@/components/ui/LoadingBar'

import { ContentList } from './ContentList'
import styles from './Content.module.scss'

/**
 * /admin/content (gallery.md §2). The guard that page.tsx had, unchanged: the
 * list renders only once it passes.
 */
export const AdminContent = () => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    } else if (sessionStatus === 'authenticated') {
      const userType = session?.user?.userType
      if (userType !== 'admin' && userType !== 'superAdmin') router.push('/')
    }
  }, [sessionStatus, session, router])

  if (sessionStatus === 'loading') {
    return (
      <div className={styles.page}>
        <LoadingBar />
      </div>
    )
  }

  const userType = session?.user?.userType
  if (sessionStatus === 'unauthenticated' || (userType !== 'admin' && userType !== 'superAdmin')) {
    return <div className={styles.page}>Not authorized</div>
  }

  return <ContentList isSuperAdmin={userType === 'superAdmin'} />
}
