'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

/**
 * Sends anyone but an admin home, as the other Content pages do. The API routes check again: this
 * only keeps the pages from flashing for a visitor. Returns whether the session is still loading
 * and whether it's an admin's.
 */
export function useAdminGate() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const isAdmin = session?.user?.userType === 'admin' || session?.user?.userType === 'superAdmin'

  useEffect(() => {
    if (status === 'unauthenticated' || (status === 'authenticated' && !isAdmin)) router.push('/')
  }, [status, isAdmin, router])

  return { loading: status === 'loading', isAdmin }
}
