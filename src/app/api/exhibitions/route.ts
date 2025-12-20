import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import type { Exhibition, Prisma } from '@/generated/prisma'
import prisma from '@/lib/prisma'
import { slugify } from '@/utils/slugify'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      mainTitle: string
      visibility: string
      userId: string
      handler: string
      spaceId: string
    }

    const { mainTitle, visibility, userId, handler, spaceId } = body

    // Generate slug from mainTitle
    const slug = slugify(mainTitle)

    const exhibition: Exhibition = await prisma.exhibition.create({
      data: {
        mainTitle,
        visibility,
        userId,
        handler,
        url: slug, // 👉 store only the slug
        spaceId,
        status: 'current',
      },
    })

    return NextResponse.json(exhibition, { status: 201 })
  } catch (error) {
    console.error('[POST /api/exhibitions] error:', error)
    console.error('[POST /api/exhibitions] error details:', JSON.stringify(error, null, 2))
    return NextResponse.json({ error: 'Failed to create exhibition' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const status = searchParams.get('status') // 'current' | 'past'
  const visibility = searchParams.get('visibility') // 'public' | 'hidden'

  try {
    // Build where clause
    const where: Prisma.ExhibitionWhereInput = {}
    
    if (userId) where.userId = userId
    if (status) where.status = status
    if (visibility) where.visibility = visibility

    const exhibitions = await prisma.exhibition.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            lastName: true,
            handler: true,
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
