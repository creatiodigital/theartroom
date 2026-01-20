import { NextResponse } from 'next/server'

import { auth } from '@/auth'

// Role hierarchy constants
const ADMIN_ROLES = ['admin', 'superAdmin'] as const
type AdminRole = (typeof ADMIN_ROLES)[number]

/**
 * Check if userType is superAdmin
 */
export function isSuperAdmin(userType: string | undefined): boolean {
  return userType === 'superAdmin'
}

/**
 * Check if userType is admin or superAdmin
 */
export function isAdminOrAbove(userType: string | undefined): boolean {
  return ADMIN_ROLES.includes(userType as AdminRole)
}

/**
 * Determine if actor can modify target user based on role hierarchy
 * - superAdmin can modify anyone
 * - admin can modify anyone EXCEPT superAdmin
 * - others cannot modify users
 */
export function canModifyUser(
  actorUserType: string | undefined,
  targetUserType: string | undefined
): boolean {
  if (isSuperAdmin(actorUserType)) {
    return true
  }
  if (actorUserType === 'admin') {
    return !isSuperAdmin(targetUserType)
  }
  return false
}

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
 * Require admin or superAdmin role
 */
export async function requireAdminOrAbove() {
  const { session, error } = await requireAuth()

  if (error) {
    return { session: null, error }
  }

  if (!isAdminOrAbove(session!.user.userType)) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Forbidden - Admin required' }, { status: 403 }),
    }
  }

  return { session, error: null }
}

/**
 * Require superAdmin role only
 */
export async function requireSuperAdmin() {
  const { session, error } = await requireAuth()

  if (error) {
    return { session: null, error }
  }

  if (!isSuperAdmin(session!.user.userType)) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Forbidden - Super Admin required' }, { status: 403 }),
    }
  }

  return { session, error: null }
}

/**
 * Legacy alias for requireAdminOrAbove (for backward compatibility)
 */
export const requireAdmin = requireAdminOrAbove

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

