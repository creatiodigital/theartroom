import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { revalidateTag, revalidatePath } from 'next/cache'

import { auth } from '@/auth'
import type { Exhibition, Prisma } from '@/generated/prisma'
import { getEffectiveUserId } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

// POST create new exhibition (requires auth)
export async function POST(request: NextRequest) {
  try {
    // Require authentication and get effective user ID
    const { userId, error: authError } = await getEffectiveUserId()
    if (authError) return authError

    const body = (await request.json()) as {
      mainTitle: string
      handler: string
      url: string
      spaceId: string
    }

    const { mainTitle, handler, url, spaceId } = body

    // Validate required fields
    if (!url) {
      return NextResponse.json({ error: 'URL slug is required' }, { status: 400 })
    }

    // Check if URL already exists for this user
    const existing = await prisma.exhibition.findFirst({
      where: {
        userId,
        url,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'An exhibition with this URL already exists' },
        { status: 409 },
      )
    }

    const exhibition: Exhibition = await prisma.exhibition.create({
      data: {
        mainTitle,
        published: false,
        userId,
        handler,
        url,
        spaceId,
        status: 'current',
      },
    })

    // Revalidate caches
    revalidateTag('exhibitions', 'default')
    revalidatePath('/')

    return NextResponse.json(exhibition, { status: 201 })
  } catch (error) {
    console.error('[POST /api/exhibitions] error:', error)
    return NextResponse.json({ error: 'Failed to create exhibition' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const status = searchParams.get('status') // 'current' | 'past'
  const published = searchParams.get('published') // 'true' | 'false'

  try {
    // Get current session to determine filtering
    const session = await auth()

    // Build where clause
    const where: Prisma.ExhibitionWhereInput = {}

    if (userId) where.userId = userId
    if (status) where.status = status

    // Permission rules:
    // - SuperAdmin: can see own + other admins + all artists/curators
    // - Admin: can see own + all artists/curators (NOT other admins or superAdmin)
    // - Artist/Curator: can see only own
    const requesterType = session?.user?.userType
    const requesterId = session?.user?.id
    const isSuperAdmin = requesterType === 'superAdmin'
    const isAdmin = requesterType === 'admin'

    // Apply permission filtering
    if (session?.user) {
      // SuperAdmin can see everything - no filter needed
      if (isSuperAdmin) {
        // No additional filter
      }
      // Admin can see their own + artists/curators (but NOT other admins or superAdmin)
      else if (isAdmin) {
        where.OR = [
          { userId: requesterId }, // Own exhibitions
          { user: { userType: { notIn: ['admin', 'superAdmin'] } } }, // Artist/curator exhibitions
        ]
      }
      // Artists/Curators: by default the userId filter already limits to their own
      // For public browsing, just filter out admin/superAdmin exhibitions
      else {
        where.user = { userType: { notIn: ['admin', 'superAdmin'] } }
      }
    } else {
      // Public (unauthenticated) users can only see artist/curator exhibitions
      where.user = { userType: { notIn: ['admin', 'superAdmin'] } }
    }

    // Draft visibility gate. This route has no auth requirement of its own,
    // and a bare `?userId=<artistId>` was returning every one of that
    // artist's exhibitions regardless of `published` — exposing a draft's
    // `mainTitle`/`url` (and, now that this branch adds them, `spacePublished`
    // / `hasPlacedArtworks`) to anyone who asked. Mirrors the
    // `viewerOwnsTarget` gate on GET /api/artworks: an unpublished exhibition
    // must be invisible everywhere, including as a bare title (see the design
    // spec, "Unpublished exhibitions must not leak").
    //
    // Admins/superAdmins keep full draft visibility — AdminExhibitions.tsx
    // has to see a draft to publish it. Everyone else only sees drafts under
    // their own userId, which is exactly what lets the artwork edit form's
    // Exhibitions picker keep showing an artist their own unpublished shows
    // while hiding them from anyone else. Filtering the query itself (rather
    // than redacting fields after the fetch) is what makes the row invisible
    // as a bare title too — there is no later step that could forget to
    // strip one field and let the rest through.
    const viewerOwnsTarget = requesterId === userId || isAdmin || isSuperAdmin
    if (viewerOwnsTarget) {
      // Owners/admins may still narrow with the explicit query param.
      if (published !== null) where.published = published === 'true'
    } else {
      // Never let an unprivileged caller widen this back open by passing
      // ?published=false themselves.
      where.published = true
    }

    const exhibitions = await prisma.exhibition.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            lastName: true,
            handler: true,
            userType: true,
            published: true,
          },
        },
        // Placed-artwork count for the admin "3D room ready" marker: a show
        // that's published, has work hung, and still has its room switched
        // off is worth flagging as a likely-forgotten step, not an error.
        _count: {
          select: { exhibitionArtworks: { where: { wallId: { not: null } } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Public listing cards show text metadata only (title, artist,
    // featured image) — the snapshot is for frozen 3D scene state, not
    // for gating textual edits. Return live DB values directly so
    // renaming an exhibition reflects on the listing without requiring
    // the artist to re-publish. (The profile page already reads live
    // `...exhibition` via /api/exhibitions/by-url, so this keeps both
    // surfaces consistent.)
    const withPlacedCounts = exhibitions.map(({ _count, ...exhibition }) => ({
      ...exhibition,
      hasPlacedArtworks: _count.exhibitionArtworks,
    }))

    return NextResponse.json(withPlacedCounts)
  } catch (error) {
    console.error('[GET /api/exhibitions] error:', error)
    return NextResponse.json({ error: 'Failed to fetch exhibitions' }, { status: 500 })
  }
}
