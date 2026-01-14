import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((request) => {
  const { auth: session, nextUrl } = request

  // Protect admin routes - require admin role
  if (nextUrl.pathname.startsWith('/admin')) {
    if (!session?.user) {
      return NextResponse.redirect(new URL('/', nextUrl.origin))
    }
    if (session.user.userType !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', nextUrl.origin))
    }
  }

  // Protect dashboard routes - require authentication
  if (nextUrl.pathname.startsWith('/dashboard')) {
    if (!session?.user) {
      return NextResponse.redirect(new URL('/', nextUrl.origin))
    }
  }

  // Protect exhibition edit routes - require authentication
  // Pattern: /:handler/exhibition/:slug/edit
  const editRouteMatch = nextUrl.pathname.match(/^\/[^/]+\/exhibition\/[^/]+\/edit$/)
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
    '/:handler/exhibition/:slug/edit',
  ],
}
