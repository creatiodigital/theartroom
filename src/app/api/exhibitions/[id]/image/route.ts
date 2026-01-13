import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { put, del } from '@vercel/blob'

import { requireOwnership } from '@/lib/authUtils'
import { MAX_UPLOAD_SIZE } from '@/lib/imageConfig'
import { processImage, isValidImageType } from '@/lib/imageProcessor'
import prisma from '@/lib/prisma'

const MAX_FILE_SIZE = MAX_UPLOAD_SIZE

// POST - Upload featured image for exhibition (requires auth + ownership)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Get the exhibition to verify it exists
    const exhibition = await prisma.exhibition.findUnique({
      where: { id },
    })

    if (!exhibition) {
      return NextResponse.json({ error: 'Exhibition not found' }, { status: 404 })
    }

    // Verify user owns this exhibition
    const { error: authError } = await requireOwnership(exhibition.userId)
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
    if (exhibition.featuredImageUrl) {
      try {
        await del(exhibition.featuredImageUrl)
      } catch (error) {
        console.warn('Failed to delete old image:', error)
      }
    }

    // Upload to Vercel Blob
    const env = process.env.NODE_ENV === 'production' ? 'production' : 'development'
    const blob = await put(`${env}/exhibitions/${id}/featured.webp`, processedBuffer, {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'image/webp',
    })

    // Update exhibition with new image URL
    await prisma.exhibition.update({
      where: { id },
      data: { featuredImageUrl: blob.url },
    })

    return NextResponse.json({
      url: blob.url,
      size: processedBuffer.length,
    })
  } catch (error) {
    console.error('[POST /api/exhibitions/[id]/image] error:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}

// DELETE - Remove featured image from exhibition (requires auth + ownership)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const exhibition = await prisma.exhibition.findUnique({
      where: { id },
    })

    if (!exhibition) {
      return NextResponse.json({ error: 'Exhibition not found' }, { status: 404 })
    }

    // Verify user owns this exhibition
    const { error: authError } = await requireOwnership(exhibition.userId)
    if (authError) return authError

    if (!exhibition.featuredImageUrl) {
      return NextResponse.json({ message: 'No image to delete' })
    }

    // Delete from Vercel Blob
    try {
      await del(exhibition.featuredImageUrl)
    } catch (error) {
      console.warn('Failed to delete blob:', error)
    }

    // Update exhibition
    await prisma.exhibition.update({
      where: { id },
      data: { featuredImageUrl: null },
    })

    return NextResponse.json({ message: 'Image deleted' })
  } catch (error) {
    console.error('[DELETE /api/exhibitions/[id]/image] error:', error)
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 })
  }
}
