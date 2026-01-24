import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { del } from '@vercel/blob'

import type { Prisma } from '@/generated/prisma'
import prisma from '@/lib/prisma'

type ExhibitionUpdateBody = {
  mainTitle?: string
  description?: string
  status?: string // 'current' | 'past'
  visibility?: string // 'public' | 'hidden'
  thumbnailUrl?: string
  bannerUrl?: string
  startDate?: string
  endDate?: string
  // Lighting customization
  ambientLightColor?: string
  ambientLightIntensity?: number
  skylightColor?: string
  skylightIntensity?: number
  ceilingLampColor?: string
  ceilingLampIntensity?: number
  windowLightColor?: string
  windowLightIntensity?: number
  floorReflectiveness?: number
  floorMaterial?: string
  floorTextureScale?: number
  floorTextureOffsetX?: number
  floorTextureOffsetY?: number
  // Camera settings
  cameraFOV?: number
  cameraElevation?: number
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
    if (body.description !== undefined) data.description = body.description
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
    if (body.skylightColor !== undefined) data.skylightColor = body.skylightColor
    if (body.skylightIntensity !== undefined) data.skylightIntensity = body.skylightIntensity
    if (body.ceilingLampColor !== undefined) data.ceilingLampColor = body.ceilingLampColor
    if (body.ceilingLampIntensity !== undefined)
      data.ceilingLampIntensity = body.ceilingLampIntensity
    if (body.windowLightColor !== undefined) data.windowLightColor = body.windowLightColor
    if (body.windowLightIntensity !== undefined)
      data.windowLightIntensity = body.windowLightIntensity
    if (body.floorReflectiveness !== undefined) data.floorReflectiveness = body.floorReflectiveness
    if (body.floorMaterial !== undefined) data.floorMaterial = body.floorMaterial
    if (body.floorTextureScale !== undefined) {
      // Clamp scale between 0.45 and 2.0
      data.floorTextureScale = Math.max(0.45, Math.min(2.0, body.floorTextureScale))
    }
    if (body.floorTextureOffsetX !== undefined) data.floorTextureOffsetX = body.floorTextureOffsetX
    if (body.floorTextureOffsetY !== undefined) data.floorTextureOffsetY = body.floorTextureOffsetY
    // Camera settings
    if (body.cameraFOV !== undefined) {
      // Clamp FOV between 40 and 60
      data.cameraFOV = Math.max(40, Math.min(60, body.cameraFOV))
    }
    if (body.cameraElevation !== undefined) {
      // Clamp elevation between 1.5 and 1.7 meters
      data.cameraElevation = Math.max(1.5, Math.min(1.7, body.cameraElevation))
    }

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
    const { id } = await context.params

    // Fetch the exhibition first to get the featuredImageUrl
    const exhibition = await prisma.exhibition.findUnique({
      where: { id },
      select: { featuredImageUrl: true },
    })

    // Delete featured image from Vercel Blob if it exists
    if (exhibition?.featuredImageUrl) {
      try {
        await del(exhibition.featuredImageUrl)
      } catch (error) {
        console.warn('Failed to delete featured image blob:', error)
        // Continue anyway - the blob might not exist
      }
    }

    await prisma.exhibition.delete({ where: { id } })

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('[DELETE /api/exhibitions/[id]] error:', error)
    return NextResponse.json({ error: 'Failed to delete exhibition' }, { status: 500 })
  }
}

