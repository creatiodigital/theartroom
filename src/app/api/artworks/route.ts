import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { auth } from '@/auth'
import { getEffectiveUserId } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET artworks for a user (public - needed for artist profiles)
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const artworkType = searchParams.get('artworkType')
    const featured = searchParams.get('featured')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Permission rules:
    // - SuperAdmin: can see own + other admins + all artists/curators
    // - Admin: can see own + all artists/curators (NOT other admins or superAdmin)
    // - Artist/Curator: can see only own
    const requesterType = session?.user?.userType
    const requesterId = session?.user?.id
    const isSuperAdmin = requesterType === 'superAdmin'
    const isAdmin = requesterType === 'admin'

    // Fetch target user's type to check permissions
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { userType: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const targetType = targetUser.userType
    const targetIsAdminOrAbove = targetType === 'admin' || targetType === 'superAdmin'

    // Check access permissions
    if (session?.user) {
      // SuperAdmin can see everything
      if (isSuperAdmin) {
        // Allow access
      }
      // Admin can see their own + artists/curators (but NOT other admins or superAdmin)
      else if (isAdmin) {
        if (targetIsAdminOrAbove && userId !== requesterId) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 })
        }
      }
      // Artists/Curators can only see their own
      else {
        if (userId !== requesterId) {
          // Allow public access to artist/curator profiles (non-admin accounts)
          if (targetIsAdminOrAbove) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 })
          }
        }
      }
    } else {
      // Public (unauthenticated) users can only see artist/curator artworks
      if (targetIsAdminOrAbove) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    const artworks = await prisma.artwork.findMany({
      where: {
        userId,
        ...(artworkType && { artworkType }),
        ...(featured === 'true' && { featured: true }),
      },
      orderBy: { order: 'asc' },
      include: {
        exhibitionArtworks: {
          include: {
            exhibition: {
              select: { id: true, mainTitle: true },
            },
          },
        },
      },
    })

    return NextResponse.json(artworks)
  } catch (error) {
    console.error('[GET /api/artworks] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST create new artwork (requires auth)
export async function POST(request: NextRequest) {
  try {
    // Require authentication and get effective user ID
    const { userId, error: authError } = await getEffectiveUserId()
    if (authError) return authError

    const body = await request.json()
    const { artworkType, title, author, year, technique, dimensions, description, featured } = body

    // Auto-generate title if not provided
    let finalTitle = title
    if (!finalTitle || finalTitle.trim() === '') {
      // Count existing artworks to generate "Untitled 1", "Untitled 2", etc.
      const count = await prisma.artwork.count({
        where: { userId },
      })
      finalTitle = `Untitled ${count + 1}`
    }

    const artwork = await prisma.artwork.create({
      data: {
        userId,
        name: finalTitle, // Use title as name for backwards compatibility
        artworkType: artworkType || 'image',
        title: finalTitle,
        author: author || null,
        year: year || null,
        technique: technique || null,
        dimensions: dimensions || null,
        description: description || null,
        featured: featured === true || featured === 'true',
      },
    })

    return NextResponse.json(artwork, { status: 201 })
  } catch (error) {
    console.error('[POST /api/artworks] error:', error)
    return NextResponse.json({ error: 'Failed to create artwork' }, { status: 500 })
  }
}
