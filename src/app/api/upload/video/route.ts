import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { getPresignedUploadUrl, deleteFromR2, buildArtworkVideoKey } from '@/lib/r2'

// 20MB max for video files
const MAX_VIDEO_SIZE = 20 * 1024 * 1024

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm']

const MIME_TO_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

/**
 * Client-side upload handler for videos via presigned R2 URLs.
 *
 * Flow:
 *  1. Client POSTs { artworkId, contentType, fileSize } to get a presigned PUT URL
 *  2. Client uploads directly to R2 using the presigned URL
 *  3. Client POSTs { artworkId, url, type: 'complete' } to finalize (update DB)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Authenticate the user
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Step 1: Generate presigned upload URL
    if (body.type === 'request-upload') {
      const { artworkId, contentType, fileSize } = body

      if (!artworkId || !contentType) {
        return NextResponse.json({ error: 'Missing artworkId or contentType' }, { status: 400 })
      }

      if (!ALLOWED_VIDEO_TYPES.includes(contentType)) {
        return NextResponse.json(
          { error: 'Invalid file type. Accepted formats: MP4, WebM.' },
          { status: 400 },
        )
      }

      if (fileSize && fileSize > MAX_VIDEO_SIZE) {
        return NextResponse.json(
          { error: 'File too large. Maximum size is 20MB.' },
          { status: 400 },
        )
      }

      // Verify artwork ownership
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

      const ext = MIME_TO_EXT[contentType] || 'mp4'
      const key = await buildArtworkVideoKey(artwork.userId, artworkId, ext)
      const presignedUrl = await getPresignedUploadUrl(key, contentType)

      // Build the public URL (what will be stored in DB)
      const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`

      return NextResponse.json({
        presignedUrl,
        publicUrl,
        key,
      })
    }

    // Step 2: Finalize upload (update DB after client uploads to R2)
    if (body.type === 'complete') {
      const { artworkId, url } = body

      if (!artworkId || !url) {
        return NextResponse.json({ error: 'Missing artworkId or url' }, { status: 400 })
      }

      // Verify artwork ownership
      const artwork = await prisma.artwork.findUnique({
        where: { id: artworkId },
        select: { userId: true, videoUrl: true },
      })

      if (!artwork) {
        return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
      }

      const userType = session.user.userType
      const isAdminOrAbove = userType === 'admin' || userType === 'superAdmin'
      if (artwork.userId !== session.user.id && !isAdminOrAbove) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      }

      // Delete old video if exists
      if (artwork.videoUrl) {
        try {
          await deleteFromR2(artwork.videoUrl)
        } catch (error) {
          console.warn('Failed to delete old video:', error)
        }
      }

      // Update artwork with new video URL
      await prisma.artwork.update({
        where: { id: artworkId },
        data: { videoUrl: url },
      })

      revalidateTag(`artwork-${artworkId}`, 'default')

      return NextResponse.json({ url })
    }

    return NextResponse.json({ error: 'Invalid request type' }, { status: 400 })
  } catch (error) {
    console.error('[POST /api/upload/video] error:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Upload failed' },
      { status: 400 },
    )
  }
}
