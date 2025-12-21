import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import prisma from '@/lib/prisma'

export async function GET(_req: NextRequest, context: { params: Promise<{ url: string }> }) {
  try {
    const { url } = await context.params

    const exhibition = await prisma.exhibition.findUnique({
      where: { url },
    })

    if (!exhibition) {
      return NextResponse.json({ error: 'Exhibition not found' }, { status: 404 })
    }

    return NextResponse.json(exhibition)
  } catch (error) {
    console.error('[GET /api/exhibitions/by-url/[url]] error:', error)
    return NextResponse.json({ error: 'Failed to fetch exhibition' }, { status: 500 })
  }
}
