'use client'

import { useCallback } from 'react'
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

  // Start impersonating a user. The server decides who may (admins only, never
  // a superAdmin target); true once its cookie is set. The caller should then
  // load the dashboard fresh — this does not refresh the session in place.
  const startImpersonation = useCallback(async (userId: string) => {
    const res = await fetch('/api/admin/impersonation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    return res.ok
  }, [])

  // Stop impersonating and return to admin mode. Resolves once the server has
  // forgotten the impersonation AND this tab's session reflects it.
  const stopImpersonation = useCallback(async () => {
    await fetch('/api/admin/impersonation', { method: 'DELETE' })
    await update()
  }, [update])

  return {
    effectiveUser,
    isImpersonating,
    realUser,
    startImpersonation,
    stopImpersonation,
    status,
  }
}
