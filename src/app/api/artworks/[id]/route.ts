import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import type { NextRequest } from 'next/server'
import { del } from '@vercel/blob'

import prisma from '@/lib/prisma'

// GET single artwork
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const artwork = await prisma.artwork.findUnique({
      where: { id },
    })

    if (!artwork) {
      return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
    }

    return NextResponse.json(artwork)
  } catch (error) {
    console.error('[GET /api/artworks/[id]] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT update artwork
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = await request.json()

    // Base update data (fields that definitely exist)
    // Sync name with title so all consumers see the updated label
    const baseData = {
      name: body.title || body.name,
      artworkType: body.artworkType,
      title: body.title,
      author: body.author,
      year: body.year,
      technique: body.technique,
      dimensions: body.dimensions,
      description: body.description,
      textContent: body.textContent,
      featured: body.featured === true || body.featured === 'true',
    }

    // Try with new fields first
    try {
      const artwork = await prisma.artwork.update({
        where: { id },
        data: {
          ...baseData,
          hiddenFromExhibition:
            body.hiddenFromExhibition === true || body.hiddenFromExhibition === 'true',
        },
      })

      // Bust caches that include this artwork's data
      revalidateTag(`artwork-${id}`, 'default')

      return NextResponse.json(artwork)
    } catch (innerError) {
      // If new field fails, try without it (fallback for schema mismatch)
      console.warn('[PUT /api/artworks/[id]] retrying without new fields:', innerError)
      const artwork = await prisma.artwork.update({
        where: { id },
        data: baseData,
      })

      // Bust caches that include this artwork's data
      revalidateTag(`artwork-${id}`, 'default')

      return NextResponse.json(artwork)
    }
  } catch (error) {
    console.error('[PUT /api/artworks/[id]] error:', error)
    return NextResponse.json({ error: 'Failed to update artwork' }, { status: 500 })
  }
}

// DELETE artwork
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    // Get artwork first to check for image
    const artwork = await prisma.artwork.findUnique({
      where: { id },
    })

    if (!artwork) {
      return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
    }

    // Delete associated blob image if exists
    if (artwork.imageUrl) {
      try {
        await del(artwork.imageUrl)
      } catch (error) {
        console.warn('Failed to delete image blob:', error)
        // Continue anyway - blob might not exist
      }
    }

    // Delete associated sound blob if exists
    if (artwork.soundUrl) {
      try {
        await del(artwork.soundUrl)
      } catch (error) {
        console.warn('Failed to delete sound blob:', error)
      }
    }

    // Delete artwork record
    await prisma.artwork.delete({
      where: { id },
    })

    // Bust detail page cache
    revalidateTag(`artwork-${id}`, 'default')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/artworks/[id]] error:', error)
    return NextResponse.json({ error: 'Failed to delete artwork' }, { status: 500 })
  }
}
