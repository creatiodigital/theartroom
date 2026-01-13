import { NextResponse } from 'next/server'

import { auth } from '@/auth'

/**
 * Get authenticated session or return unauthorized response
 */
export async function requireAuth() {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return { session, error: null }
}

/**
 * Verify the authenticated user owns the resource
 * @param resourceUserId - The userId associated with the resource
 */
export async function requireOwnership(resourceUserId: string) {
  const { session, error } = await requireAuth()

  if (error) {
    return { session: null, error }
  }

  // Allow if user owns the resource OR is impersonating the owner
  const effectiveUserId = session!.impersonating?.id || session!.user.id

  if (effectiveUserId !== resourceUserId) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { session, error: null }
}

/**
 * Require admin role
 */
export async function requireAdmin() {
  const { session, error } = await requireAuth()

  if (error) {
    return { session: null, error }
  }

  if (session!.user.userType !== 'admin') {
    return {
      session: null,
      error: NextResponse.json({ error: 'Forbidden - Admin required' }, { status: 403 }),
    }
  }

  return { session, error: null }
}

/**
 * Get the effective user ID (handles impersonation)
 */
export async function getEffectiveUserId() {
  const { session, error } = await requireAuth()

  if (error) {
    return { userId: null, error }
  }

  const userId = session!.impersonating?.id || session!.user.id

  return { userId, error: null }
}
