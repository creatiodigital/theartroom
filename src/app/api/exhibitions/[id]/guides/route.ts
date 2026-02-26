import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import prisma from '@/lib/prisma'

/* ------------------------ GET ------------------------ */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const wallId = req.nextUrl.searchParams.get('wallId')

    if (!wallId) {
      return NextResponse.json({ error: 'wallId is required' }, { status: 400 })
    }

    const guides = await prisma.wallGuide.findMany({
      where: { exhibitionId: id, wallId },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(guides)
  } catch (error) {
    console.error('[GET /api/exhibitions/[id]/guides] error:', error)
    return NextResponse.json({ error: 'Failed to fetch guides' }, { status: 500 })
  }
}

/* ------------------------ POST ------------------------ */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = await req.json()
    const { wallId, orientation, position } = body as {
      wallId: string
      orientation: string
      position: number
    }

    if (!wallId || !orientation || position === undefined) {
      return NextResponse.json({ error: 'wallId, orientation, and position are required' }, { status: 400 })
    }

    const guide = await prisma.wallGuide.create({
      data: {
        exhibitionId: id,
        wallId,
        orientation,
        position,
      },
    })

    return NextResponse.json(guide)
  } catch (error) {
    console.error('[POST /api/exhibitions/[id]/guides] error:', error)
    return NextResponse.json({ error: 'Failed to create guide' }, { status: 500 })
  }
}

/* ------------------------ PUT ------------------------ */
export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = await req.json()
    const { guideId, position } = body as { guideId: string; position: number }

    if (!guideId || position === undefined) {
      return NextResponse.json({ error: 'guideId and position are required' }, { status: 400 })
    }

    const guide = await prisma.wallGuide.update({
      where: { id: guideId, exhibitionId: id },
      data: { position },
    })

    return NextResponse.json(guide)
  } catch (error) {
    console.error('[PUT /api/exhibitions/[id]/guides] error:', error)
    return NextResponse.json({ error: 'Failed to update guide' }, { status: 500 })
  }
}

/* ------------------------ DELETE ------------------------ */
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = await req.json()
    const { guideId } = body as { guideId: string }

    if (!guideId) {
      return NextResponse.json({ error: 'guideId is required' }, { status: 400 })
    }

    await prisma.wallGuide.delete({
      where: { id: guideId, exhibitionId: id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/exhibitions/[id]/guides] error:', error)
    return NextResponse.json({ error: 'Failed to delete guide' }, { status: 500 })
  }
}
