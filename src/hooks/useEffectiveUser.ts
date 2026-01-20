'use client'

import { useSession } from 'next-auth/react'

/**
 * Hook that returns the "effective" user - either the impersonated user
 * (if admin is impersonating) or the actual logged-in user.
 *
 * Use this hook in dashboard pages instead of directly accessing session.user
 * to ensure impersonation works correctly.
 */
export function useEffectiveUser() {
  const { data: session, status, update } = useSession()

  const isImpersonating = !!session?.impersonating
  const realUser = session?.user

  // When impersonating, return the impersonated user's info
  // Otherwise, return the actual logged-in user
  const effectiveUser = isImpersonating
    ? {
        id: session.impersonating!.id,
        name: session.impersonating!.name,
        handler: session.impersonating!.handler,
      }
    : session?.user

  // Start impersonating a user (admin or superAdmin only)
  const startImpersonation = async (user: { id: string; name: string; handler: string }) => {
    const userType = session?.user?.userType
    if (userType !== 'admin' && userType !== 'superAdmin') {
      console.error('Only admins can impersonate')
      return false
    }

    await update({
      impersonating: {
        id: user.id,
        name: user.name,
        handler: user.handler,
      },
    })
    return true
  }

  // Stop impersonating and return to admin mode
  const stopImpersonation = async () => {
    await update({ impersonating: null })
  }

  return {
    effectiveUser,
    isImpersonating,
    realUser,
    startImpersonation,
    stopImpersonation,
    status,
  }
}
