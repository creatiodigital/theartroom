import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import type { Prisma } from '@/generated/prisma'
import prisma from '@/lib/prisma'

type ExhibitionUpdateBody = {
  mainTitle?: string
  status?: string // 'current' | 'past'
  visibility?: string // 'public' | 'hidden'
  thumbnailUrl?: string
  bannerUrl?: string
  startDate?: string
  endDate?: string
  // Lighting customization
  ambientLightColor?: string
  ambientLightIntensity?: number
}

/* ------------------------ GET ------------------------ */
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const exhibition = await prisma.exhibition.findUnique({
      where: { id },
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
    })

    if (!exhibition) {
      return NextResponse.json({ error: 'Exhibition not found' }, { status: 404 })
    }

    return NextResponse.json(exhibition)
  } catch (error) {
    console.error('[GET /api/exhibitions/[id]] error:', error)
    return NextResponse.json({ error: 'Failed to fetch exhibition' }, { status: 500 })
  }
}

/* ------------------------ PUT ------------------------ */
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = (await request.json()) as ExhibitionUpdateBody

    const data: Prisma.ExhibitionUpdateInput = {}
    if (body.mainTitle !== undefined) data.mainTitle = body.mainTitle
    if (body.status !== undefined) data.status = body.status
    if (body.visibility !== undefined) data.visibility = body.visibility
    if (body.thumbnailUrl !== undefined) data.thumbnailUrl = body.thumbnailUrl
    if (body.bannerUrl !== undefined) data.bannerUrl = body.bannerUrl
    if (body.startDate !== undefined) data.startDate = new Date(body.startDate)
    if (body.endDate !== undefined) data.endDate = new Date(body.endDate)
    // Lighting customization
    if (body.ambientLightColor !== undefined) data.ambientLightColor = body.ambientLightColor
    if (body.ambientLightIntensity !== undefined)
      data.ambientLightIntensity = body.ambientLightIntensity

    const updated = await prisma.exhibition.update({
      where: { id },
      data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[PUT /api/exhibitions/[id]] error:', error)
    return NextResponse.json({ error: 'Failed to update exhibition' }, { status: 500 })
  }
}

/* ------------------------ DELETE ------------------------ */
export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    // params is now a Promise — must be awaited
    const { id } = await context.params

    await prisma.exhibition.delete({ where: { id } })

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('[DELETE /api/exhibitions/[id]] error:', error)
    return NextResponse.json({ error: 'Failed to delete exhibition' }, { status: 500 })
  }
}
