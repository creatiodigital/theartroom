import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET check if exhibition URL is available for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const url = searchParams.get('url')

    if (!userId || !url) {
      return NextResponse.json(
        { error: 'userId and url are required' },
        { status: 400 }
      )
    }

    // Check if an exhibition with this URL already exists for this user
    const existing = await prisma.exhibition.findFirst({
      where: {
        userId,
        url,
      },
      select: { id: true },
    })

    return NextResponse.json({
      available: !existing,
      url,
    })
  } catch (error) {
    console.error('[GET /api/exhibitions/check-url] error:', error)
    return NextResponse.json(
      { error: 'Failed to check URL availability' },
      { status: 500 }
    )
  }
}
