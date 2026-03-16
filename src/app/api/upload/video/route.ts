import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { revalidateTag } from 'next/cache'
import { del } from '@vercel/blob'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'

// 20MB max for video files
const MAX_VIDEO_SIZE = 20 * 1024 * 1024

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
]

/**
 * Client-side upload handler for videos.
 * The browser uploads directly to Vercel Blob, bypassing the serverless
 * function body-size limit (4.5 MB).
 *
 * Flow:
 *  1. Client requests a signed upload token (POST with type=client.generateClientToken)
 *  2. Client uploads directly to Vercel Blob using the token
 *  3. Vercel Blob calls back this route (POST with type=blob.upload-completed)
 *  4. We update the artwork record with the new videoUrl
 */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Authenticate the user
        const session = await auth()
        if (!session?.user?.id) {
          throw new Error('Not authenticated')
        }

        // Extract artwork ID from the pathname (format: env/userId/videos/artworkId.ext)
        const parts = pathname.split('/')
        const filename = parts[parts.length - 1]
        const artworkId = filename?.split('.')[0]

        if (!artworkId) {
          throw new Error('Invalid upload path')
        }

        // Verify artwork ownership
        const artwork = await prisma.artwork.findUnique({
          where: { id: artworkId },
          select: { userId: true },
        })

        if (!artwork) {
          throw new Error('Artwork not found')
        }

        const userType = session.user.userType
        const isAdminOrAbove = userType === 'admin' || userType === 'superAdmin'
        if (artwork.userId !== session.user.id && !isAdminOrAbove) {
          throw new Error('Not authorized')
        }

        return {
          allowedContentTypes: ALLOWED_VIDEO_TYPES,
          maximumSizeInBytes: MAX_VIDEO_SIZE,
          tokenPayload: JSON.stringify({
            artworkId,
            userId: session.user.id,
          }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // This is called by Vercel Blob after the upload completes
        // Update the artwork record with the new video URL
        try {
          const payload = JSON.parse(tokenPayload ?? '{}')
          const artworkId = payload.artworkId as string

          if (!artworkId) {
            console.error('[video-upload] No artworkId in token payload')
            return
          }

          // Delete old video if exists
          const artwork = await prisma.artwork.findUnique({
            where: { id: artworkId },
            select: { videoUrl: true },
          })

          if (artwork?.videoUrl) {
            try {
              await del(artwork.videoUrl)
            } catch (error) {
              console.warn('Failed to delete old video:', error)
            }
          }

          // Update artwork with new video URL
          await prisma.artwork.update({
            where: { id: artworkId },
            data: { videoUrl: blob.url },
          })

          revalidateTag(`artwork-${artworkId}`, 'default')
        } catch (error) {
          console.error('[video-upload] onUploadCompleted error:', error)
          throw error
        }
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error('[POST /api/upload/video] error:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Upload failed' },
      { status: 400 },
    )
  }
}
