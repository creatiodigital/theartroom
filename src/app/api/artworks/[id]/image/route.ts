import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { put, del } from '@vercel/blob'

import { requireOwnership } from '@/lib/authUtils'
import { MAX_UPLOAD_SIZE } from '@/lib/imageConfig'
import { processImage, isValidImageType } from '@/lib/imageProcessor'
import prisma from '@/lib/prisma'

const MAX_FILE_SIZE = MAX_UPLOAD_SIZE // 5MB from centralized config

// POST - Upload image for artwork (requires auth + ownership)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Get the artwork to verify it exists
    const artwork = await prisma.artwork.findUnique({
      where: { id },
    })

    if (!artwork) {
      return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
    }

    // Verify user owns this artwork
    const { error: authError } = await requireOwnership(artwork.userId)
    if (authError) return authError

    // Get the image from form data
    const formData = await request.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 })
    }

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Validate image type by magic bytes
    if (!isValidImageType(buffer)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a JPG, PNG, WebP, or GIF image.' },
        { status: 400 },
      )
    }

    // Process image (resize + convert to WebP)
    const processedBuffer = await processImage(buffer)

    // Delete old image if exists
    if (artwork.imageUrl) {
      try {
        await del(artwork.imageUrl)
      } catch (error) {
        console.warn('Failed to delete old image:', error)
        // Continue anyway - old image might not exist
      }
    }

    // Upload to Vercel Blob - organize by environment and user ID (immutable)
    const env = process.env.NODE_ENV === 'production' ? 'production' : 'development'
    const blob = await put(`${env}/${artwork.userId}/${id}.webp`, processedBuffer, {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'image/webp',
    })

    // Update artwork with new image URL
    await prisma.artwork.update({
      where: { id },
      data: { imageUrl: blob.url },
    })

    return NextResponse.json({
      url: blob.url,
      size: processedBuffer.length,
    })
  } catch (error) {
    console.error('[POST /api/artworks/[id]/image] error:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}

// DELETE - Remove image from artwork (requires auth + ownership)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const artwork = await prisma.artwork.findUnique({
      where: { id },
    })

    if (!artwork) {
      return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
    }

    // Verify user owns this artwork
    const { error: authError } = await requireOwnership(artwork.userId)
    if (authError) return authError

    if (!artwork.imageUrl) {
      return NextResponse.json({ message: 'No image to delete' })
    }

    // Delete from Vercel Blob
    try {
      await del(artwork.imageUrl)
    } catch (error) {
      console.warn('Failed to delete blob:', error)
    }

    // Update artwork
    await prisma.artwork.update({
      where: { id },
      data: { imageUrl: null },
    })

    return NextResponse.json({ message: 'Image deleted' })
  } catch (error) {
    console.error('[DELETE /api/artworks/[id]/image] error:', error)
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 })
  }
}
