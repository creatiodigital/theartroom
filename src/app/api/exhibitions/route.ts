import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { auth } from '@/auth'
import type { Exhibition, Prisma } from '@/generated/prisma'
import { getEffectiveUserId } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic'

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
    if (published !== null) where.published = published === 'true'

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
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(exhibitions)
  } catch (error) {
    console.error('[GET /api/exhibitions] error:', error)
    return NextResponse.json({ error: 'Failed to fetch exhibitions' }, { status: 500 })
  }
}
