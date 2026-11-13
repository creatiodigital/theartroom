'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { LoadingBar } from '@/components/ui/LoadingBar'

import { ExhibitionsList } from './ExhibitionsList'
import styles from './Exhibitions.module.scss'

/**
 * /admin/exhibitions (exhibitions.md). The guard that page.tsx had, unchanged:
 * the list mounts only once it passes, so its first request waits for it.
 */
export const AdminExhibitions = () => {
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

  return <ExhibitionsList />
}
