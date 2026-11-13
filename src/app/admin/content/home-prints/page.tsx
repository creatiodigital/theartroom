'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { GallerySelection } from '@/components/admin/GallerySelection'
import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'
import { LoadingBar } from '@/components/ui/LoadingBar'

const HomePrintsPage = () => {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Super admin only — this is the gallery's own editorial voice. The API
  // enforces it too; this is just so the screen never flashes into view.
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
    else if (status === 'authenticated' && session?.user?.userType !== 'superAdmin')
      router.push('/')
  }, [status, session, router])

  if (status === 'loading') {
    return (
      <div className={dashboardStyles.page}>
        <LoadingBar />
      </div>
    )
  }
  if (status === 'unauthenticated' || session?.user?.userType !== 'superAdmin') {
    return <div className={dashboardStyles.page}>Not authorized</div>
  }

  // Home page prints (home.md §5): Gallery selection's screen on its own list.
  return <GallerySelection list="home" />
}

export default HomePrintsPage
