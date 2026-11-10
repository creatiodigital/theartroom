import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { requireAuth } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET check if an exhibition URL is available. Signed-in only: both callers are
// dashboard screens, and the answer reveals whether any exhibition — a draft
// included — already holds that URL.
export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requireAuth()
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')
    const excludeId = searchParams.get('excludeId')

    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }

    // `Exhibition.url` is unique across ALL artists, so availability is global
    // — checked per user, two artists could both be told "available" and the
    // second save would fail with a 500. Optionally exclude the exhibition
    // being edited.
    const existing = await prisma.exhibition.findFirst({
      where: {
        url,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    })

    return NextResponse.json({
      available: !existing,
      url,
    })
  } catch (error) {
    console.error('[GET /api/exhibitions/check-url] error:', error)
    return NextResponse.json({ error: 'Failed to check URL availability' }, { status: 500 })
  }
}
