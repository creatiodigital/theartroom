import { cookies } from 'next/headers'

import prisma from '@/lib/prisma'

/**
 * Admin impersonation lives in its OWN cookie, never inside the login cookie.
 *
 * It used to ride in the NextAuth JWT, and two bugs came from that:
 *
 *   - Stopping was silently undone. The proxy re-issues the login cookie on
 *     every /admin and /dashboard request, re-encoding whatever token THAT
 *     request carried — so any request still in flight from before a Stop
 *     landed after it and wrote the impersonation back.
 *   - Closing the browser did not end it: the login cookie lasts 30 days.
 *
 * This cookie has exactly one writer (POST/DELETE /api/admin/impersonation),
 * so nothing else can bring it back, and no expiry, so the browser drops it
 * when it closes.
 *
 * It is not signed, and does not need to be: it only NAMES whom the admin is
 * viewing as. Every read re-checks the real, logged-in user — it must be the
 * admin who set it and still an admin — so a forged or leftover value is
 * simply ignored.
 */
export const IMPERSONATION_COOKIE = 'impersonating'

export const impersonationCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  // No maxAge / expires on purpose: a browser-session cookie.
} as const

/** `adminId:targetId` — the admin is part of the value so it never carries over to another login. */
export const impersonationCookieValue = (adminId: string, targetId: string) =>
  `${adminId}:${targetId}`

export const canBeImpersonated = (userType: string) => userType !== 'superAdmin'

/**
 * Whom the logged-in user is viewing as, or null. Called from the session
 * callback, so every `session.impersonating` in the app comes from here.
 */
export async function readImpersonation(realUserId: string, realUserType: string | undefined) {
  if (realUserType !== 'admin' && realUserType !== 'superAdmin') return null

  let value: string | undefined
  try {
    value = (await cookies()).get(IMPERSONATION_COOKIE)?.value
  } catch {
    // No request cookies in this context (e.g. the proxy): nothing to read.
    return null
  }
  if (!value) return null

  const [adminId, targetId] = value.split(':')
  if (adminId !== realUserId || !targetId) return null

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, name: true, lastName: true, handler: true, userType: true },
  })
  if (!target || !canBeImpersonated(target.userType)) return null

  return {
    id: target.id,
    name: `${target.name} ${target.lastName}`.trim(),
    handler: target.handler,
  }
}
