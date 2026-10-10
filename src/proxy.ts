import { auth } from '@/auth'
import { NextResponse, type NextRequest } from 'next/server'

// Role hierarchy constants
const ADMIN_ROLES = ['admin', 'superAdmin'] as const

// Length-independent comparison, so the password can't be guessed a character
// at a time from response timing.
const safeEqual = (a: string, b: string): boolean => {
  let diff = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return diff === 0
}

/**
 * Staging password (HTTP Basic Auth) — a free stand-in for Vercel's paid
 * Password Protection, so strangers and crawlers that find the staging domain
 * see a browser login prompt instead of the site and its test data.
 *
 * Switched on by the credentials themselves: STAGING_BASIC_AUTH_USER and
 * STAGING_BASIC_AUTH_PASSWORD exist only in Vercel's staging environment.
 * Production, localhost and e2e have neither, so this returns null there. The
 * APP_ENV check is a second lock — it must not be the only one, because
 * .env.local sets NEXT_PUBLIC_APP_ENV=staging and would challenge local dev.
 */
const stagingPasswordChallenge = (request: NextRequest): NextResponse | null => {
  const user = process.env.STAGING_BASIC_AUTH_USER
  const password = process.env.STAGING_BASIC_AUTH_PASSWORD
  if (!user || !password || process.env.NEXT_PUBLIC_APP_ENV === 'production') return null

  const header = request.headers.get('authorization')
  if (header?.startsWith('Basic ')) {
    try {
      // atob, not Buffer: the proxy must not assume a Node runtime.
      const decoded = atob(header.slice('Basic '.length))
      const separator = decoded.indexOf(':')
      if (
        separator !== -1 &&
        safeEqual(decoded.slice(0, separator), user) &&
        safeEqual(decoded.slice(separator + 1), password)
      ) {
        return null
      }
    } catch {
      // Malformed base64 — fall through to the challenge.
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Staging", charset="UTF-8"' },
  })
}

export default auth((request) => {
  // Staging password first — on staging nothing else is reachable without it.
  const challenge = stagingPasswordChallenge(request)
  if (challenge) return challenge

  const { auth: session, nextUrl } = request

  // Protect admin routes - require admin or superAdmin role
  if (nextUrl.pathname.startsWith('/admin')) {
    if (!session?.user) {
      return NextResponse.redirect(new URL('/', nextUrl.origin))
    }
    if (!ADMIN_ROLES.includes(session.user.userType as (typeof ADMIN_ROLES)[number])) {
      return NextResponse.redirect(new URL('/dashboard', nextUrl.origin))
    }
  }

  // Protect dashboard routes - require authentication (except login page)
  if (nextUrl.pathname.startsWith('/dashboard') && nextUrl.pathname !== '/dashboard/login') {
    if (!session?.user) {
      return NextResponse.redirect(new URL('/dashboard/login', nextUrl.origin))
    }
  }

  // Protect exhibition edit routes - require authentication
  // Real route: /exhibitions/:artistSlug/:exhibitionSlug/edit
  const editRouteMatch = nextUrl.pathname.match(/^\/exhibitions\/[^/]+\/[^/]+\/edit$/)
  if (editRouteMatch) {
    if (!session?.user) {
      return NextResponse.redirect(new URL('/', nextUrl.origin))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/exhibitions/:artistSlug/:exhibitionSlug/edit',
    // Every other page and API — on the staging host ONLY, so production never
    // runs the proxy for them (no extra function call per page view).
    // Excluded: Next's own static files, and the callers that can't send a
    // password and verify themselves instead — the Stripe webhook (signature)
    // and Vercel cron (CRON_SECRET).
    {
      source: '/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/cron).*)',
      has: [{ type: 'host', value: 'staging.theartroom.gallery' }],
    },
  ],
}
