import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'

import { auth } from '@/auth'
import { processImage, isValidImageType } from '@/lib/imageProcessor'
import prisma from '@/lib/prisma'
import {
  uploadToR2,
  deleteFromR2,
  getPresignedUploadUrl,
  buildArtworkImageKey,
  buildOriginalImageKey,
} from '@/lib/r2'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/**
 * Client-side upload handler for artwork images via presigned R2 URLs.
 *
 * Flow:
 *  1. Client POSTs { type: 'request-upload', artworkId, contentType, fileSize }
 *     → returns presigned URL for the original + the original's public URL
 *  2. Client uploads the original directly to R2 using the presigned URL
 *  3. Client POSTs { type: 'complete', artworkId, originalUrl, contentType }
 *     → server downloads the original from R2, generates web-optimized WebP,
 *       uploads that to CDN path, updates DB with both URLs + dimensions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Step 1: Generate presigned upload URL for the original
    if (body.type === 'request-upload') {
      const { artworkId, contentType, fileSize } = body

      if (!artworkId || !contentType) {
        return NextResponse.json({ error: 'Missing artworkId or contentType' }, { status: 400 })
      }

      if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
        return NextResponse.json(
          { error: 'Invalid file type. Accepted: JPG, PNG, WebP, GIF.' },
          { status: 400 },
        )
      }

      if (fileSize && fileSize > 200 * 1024 * 1024) {
        return NextResponse.json({ error: 'File too large. Maximum is 200MB.' }, { status: 400 })
      }

      const artwork = await prisma.artwork.findUnique({
        where: { id: artworkId },
        select: { userId: true },
      })

      if (!artwork) {
        return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
      }

      const userType = session.user.userType
      const isAdminOrAbove = userType === 'admin' || userType === 'superAdmin'
      if (artwork.userId !== session.user.id && !isAdminOrAbove) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      }

      const ext = MIME_TO_EXT[contentType] || 'jpg'
      const originalKey = await buildOriginalImageKey(artwork.userId, artworkId, ext)
      const presignedUrl = await getPresignedUploadUrl(originalKey, contentType)
      const originalUrl = `${process.env.R2_PUBLIC_URL}/${originalKey}`

      return NextResponse.json({ presignedUrl, originalUrl, originalKey })
    }

    // Step 2: Finalize — download original from R2, generate web version, update DB
    if (body.type === 'complete') {
      const { artworkId, originalUrl } = body

      if (!artworkId || !originalUrl) {
        return NextResponse.json({ error: 'Missing artworkId or originalUrl' }, { status: 400 })
      }

      const artwork = await prisma.artwork.findUnique({
        where: { id: artworkId },
        select: { userId: true, imageUrl: true, originalImageUrl: true },
      })

      if (!artwork) {
        return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
      }

      const userType = session.user.userType
      const isAdminOrAbove = userType === 'admin' || userType === 'superAdmin'
      if (artwork.userId !== session.user.id && !isAdminOrAbove) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      }

      // Download the original from R2 to process it
      const originalResponse = await fetch(originalUrl)
      if (!originalResponse.ok) {
        return NextResponse.json({ error: 'Failed to fetch uploaded original' }, { status: 500 })
      }

      const originalBuffer = Buffer.from(await originalResponse.arrayBuffer())

      if (!isValidImageType(originalBuffer)) {
        return NextResponse.json(
          { error: 'Invalid file type. Please upload a JPG, PNG, WebP, or GIF image.' },
          { status: 400 },
        )
      }

      // Get original dimensions, DPI, format, and size
      const sharp = (await import('sharp')).default
      const metadata = await sharp(originalBuffer).metadata()
      const originalWidth = metadata.width ?? 0
      const originalHeight = metadata.height ?? 0
      const originalDpi = metadata.density ?? null
      const formatMap: Record<string, string> = {
        jpeg: 'JPEG',
        png: 'PNG',
        webp: 'WebP',
        gif: 'GIF',
      }
      const originalFormat =
        formatMap[metadata.format ?? ''] ?? metadata.format?.toUpperCase() ?? null
      const originalSizeBytes = originalBuffer.length

      // Generate web-optimized version
      const processedBuffer = await processImage(originalBuffer)

      // Delete old images if they exist
      if (artwork.imageUrl) {
        try {
          await deleteFromR2(artwork.imageUrl)
        } catch (error) {
          console.warn('Failed to delete old web image:', error)
        }
      }
      if (artwork.originalImageUrl) {
        try {
          await deleteFromR2(artwork.originalImageUrl)
        } catch (error) {
          console.warn('Failed to delete old original image:', error)
        }
      }

      // Upload web-optimized version to CDN path
      const webKey = await buildArtworkImageKey(artwork.userId, artworkId)
      const webUrl = await uploadToR2(webKey, processedBuffer, 'image/webp')

      // Update artwork with both URLs + dimensions
      console.log('[upload/image complete] saving original metadata:', {
        originalWidth,
        originalHeight,
        originalDpi,
        originalFormat,
        originalSizeBytes,
      })
      await prisma.artwork.update({
        where: { id: artworkId },
        data: {
          imageUrl: webUrl,
          originalImageUrl: originalUrl,
          originalWidth,
          originalHeight,
          originalDpi,
          originalFormat,
          originalSizeBytes,
        },
      })

      revalidateTag(`artwork-${artworkId}`, 'default')

      return NextResponse.json({
        imageUrl: webUrl,
        originalImageUrl: originalUrl,
        originalWidth,
        originalHeight,
        originalDpi,
        originalFormat,
        originalSizeBytes,
      })
    }

    return NextResponse.json({ error: 'Invalid request type' }, { status: 400 })
  } catch (error) {
    console.error('[POST /api/upload/image] error:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Upload failed' },
      { status: 500 },
    )
  }
}
