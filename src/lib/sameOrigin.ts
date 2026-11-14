import type { NextRequest } from 'next/server'

/**
 * The request's own host: the page that sends it must be on it (this site, staging or dev). A
 * browser always sends `Origin` on a POST, PUT or DELETE, so a request without one, or from
 * another site, is refused (forged cross-site requests). Shared by the visitor feedback route and
 * the admin's feedback deletes.
 */
export const isSameOrigin = (request: NextRequest) => {
  const origin = request.headers.get('origin')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!origin || !host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}
