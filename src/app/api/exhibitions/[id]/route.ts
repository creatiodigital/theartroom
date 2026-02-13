import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { revalidateTag, revalidatePath } from 'next/cache'
import { del } from '@vercel/blob'

import { Prisma } from '@/generated/prisma'
import prisma from '@/lib/prisma'
import { buildExhibitionSnapshot } from '@/lib/exhibitionSnapshot'

import { slugify } from '@/utils/slugify'

type ExhibitionUpdateBody = {
  mainTitle?: string
  description?: string
  shortDescription?: string
  status?: string // 'current' | 'past'
  published?: boolean
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
  trackLampColor?: string
  trackLampIntensity?: number
  trackLampsVisible?: boolean
  recessedLampColor?: string
  recessedLampIntensity?: number
  trackLampMaterialColor?: string
  windowLightColor?: string
  windowLightIntensity?: number
  floorReflectiveness?: number
  floorMaterial?: string
  floorTextureScale?: number
  floorTextureOffsetX?: number
  floorTextureOffsetY?: number
  floorTemperature?: number
  floorNormalScale?: number
  floorRotation?: number
  // Camera settings
  cameraFOV?: number
  cameraElevation?: number
  hdriEnvironment?: string
  ceilingLightMode?: string
  // Furniture
  benchVisible?: boolean
  benchPositionX?: number
  benchPositionZ?: number
  benchRotationY?: number
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
    if (body.mainTitle !== undefined) {
      data.mainTitle = body.mainTitle
      const newUrl = slugify(body.mainTitle)
      data.url = newUrl

      // Check if another exhibition by this user already uses this URL
      const current = await prisma.exhibition.findUnique({
        where: { id },
        select: { userId: true },
      })
      if (current) {
        const conflict = await prisma.exhibition.findFirst({
          where: {
            userId: current.userId,
            url: newUrl,
            id: { not: id },
          },
          select: { id: true },
        })
        if (conflict) {
          return NextResponse.json(
            { error: 'An exhibition with this name already exists' },
            { status: 409 },
          )
        }
      }
    }
    if (body.description !== undefined) data.description = body.description
    if (body.shortDescription !== undefined) data.shortDescription = body.shortDescription
    if (body.status !== undefined) data.status = body.status
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
    if (body.trackLampColor !== undefined) data.trackLampColor = body.trackLampColor
    if (body.trackLampIntensity !== undefined) data.trackLampIntensity = body.trackLampIntensity
    if (body.trackLampsVisible !== undefined) data.trackLampsVisible = body.trackLampsVisible
    if (body.recessedLampColor !== undefined) data.recessedLampColor = body.recessedLampColor
    if (body.recessedLampIntensity !== undefined)
      data.recessedLampIntensity = body.recessedLampIntensity
    if (body.trackLampMaterialColor !== undefined)
      data.trackLampMaterialColor = body.trackLampMaterialColor
    if (body.windowLightColor !== undefined) data.windowLightColor = body.windowLightColor
    if (body.windowLightIntensity !== undefined)
      data.windowLightIntensity = body.windowLightIntensity
    if (body.floorReflectiveness !== undefined) data.floorReflectiveness = body.floorReflectiveness
    if (body.floorMaterial !== undefined) data.floorMaterial = body.floorMaterial
    if (body.floorTextureScale !== undefined) {
      // Clamp scale between 0.5 and 5.0
      data.floorTextureScale = Math.max(0.5, Math.min(5.0, body.floorTextureScale))
    }
    if (body.floorTextureOffsetX !== undefined) data.floorTextureOffsetX = body.floorTextureOffsetX
    if (body.floorTextureOffsetY !== undefined) data.floorTextureOffsetY = body.floorTextureOffsetY
    if (body.floorTemperature !== undefined) {
      // Clamp temperature between -1 (cool) and 1 (warm)
      data.floorTemperature = Math.max(-1, Math.min(1, body.floorTemperature))
    }
    if (body.floorNormalScale !== undefined) {
      // Clamp normal scale between 0 and 5.0
      data.floorNormalScale = Math.max(0, Math.min(5.0, body.floorNormalScale))
    }
    if (body.floorRotation !== undefined) {
      // Clamp rotation between 0 and 360 degrees
      data.floorRotation = ((body.floorRotation % 360) + 360) % 360
    }
    // Camera settings
    if (body.cameraFOV !== undefined) {
      // Clamp FOV between 40 and 60
      data.cameraFOV = Math.max(40, Math.min(60, body.cameraFOV))
    }
    if (body.cameraElevation !== undefined) {
      // Clamp elevation between 1.5 and 1.7 meters
      data.cameraElevation = Math.max(1.5, Math.min(1.7, body.cameraElevation))
    }

    if (body.hdriEnvironment !== undefined) data.hdriEnvironment = body.hdriEnvironment
    if (body.ceilingLightMode !== undefined) data.ceilingLightMode = body.ceilingLightMode
    // Furniture
    if (body.benchVisible !== undefined) data.benchVisible = body.benchVisible
    if (body.benchPositionX !== undefined) data.benchPositionX = body.benchPositionX
    if (body.benchPositionZ !== undefined) data.benchPositionZ = body.benchPositionZ
    if (body.benchRotationY !== undefined) {
      data.benchRotationY = ((body.benchRotationY % 360) + 360) % 360
    }

    // --- Draft/Publish logic ---
    if (body.published === true) {
      // Publishing or re-publishing: build snapshot from current state
      data.published = true
      const snapshot = await buildExhibitionSnapshot(id)
      data.publishedSnapshot = snapshot
      data.publishedAt = new Date()
      data.hasPendingChanges = false
    } else if (body.published === false) {
      // Unpublishing: clear snapshot
      data.published = false
      data.publishedSnapshot = Prisma.JsonNull
      data.publishedAt = null
      data.hasPendingChanges = false
    } else {
      // Any other edit on a published exhibition → mark as having pending changes
      const exhibition = await prisma.exhibition.findUnique({
        where: { id },
        select: { published: true },
      })
      if (exhibition?.published) {
        data.hasPendingChanges = true
      }
    }

    const updated = await prisma.exhibition.update({
      where: { id },
      data,
    })

    // Revalidate caches
    revalidateTag(`exhibition-${updated.url}`, 'default')
    if (body.published !== undefined || body.mainTitle !== undefined) {
      revalidateTag('exhibitions', 'default')
      revalidatePath('/')
    }

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

    // Revalidate caches
    revalidateTag('exhibitions', 'default')
    revalidatePath('/')

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('[DELETE /api/exhibitions/[id]] error:', error)
    return NextResponse.json({ error: 'Failed to delete exhibition' }, { status: 500 })
  }
}
