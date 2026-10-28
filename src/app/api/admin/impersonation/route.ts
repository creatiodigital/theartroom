import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { requireAdminOrAbove } from '@/lib/authUtils'
import {
  IMPERSONATION_COOKIE,
  canBeImpersonated,
  impersonationCookieOptions,
  impersonationCookieValue,
} from '@/lib/impersonation'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/impersonation  { userId } — start viewing the site as that user.
 * DELETE /api/admin/impersonation           — stop.
 *
 * The ONLY writer of the impersonation cookie (see lib/impersonation for why
 * it is not part of the login cookie).
 */
export async function POST(request: Request) {
  const { session, error } = await requireAdminOrAbove()
  if (error) return error

  const body = await request.json().catch(() => null)
  const userId = typeof body?.userId === 'string' ? body.userId : null
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, userType: true },
  })
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  // superAdmin accounts can never be impersonated (their scope includes user
  // management itself).
  if (!canBeImpersonated(target.userType)) {
    return NextResponse.json({ error: 'This user cannot be impersonated' }, { status: 403 })
  }

  ;(await cookies()).set(
    IMPERSONATION_COOKIE,
    impersonationCookieValue(session!.user.id, target.id),
    impersonationCookieOptions,
  )
  return new NextResponse(null, { status: 204 })
}

/** Anyone may stop — ending an impersonation never grants anything. */
export async function DELETE() {
  ;(await cookies()).delete(IMPERSONATION_COOKIE)
  return new NextResponse(null, { status: 204 })
}
