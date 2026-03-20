import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'

import { requireOwnership } from '@/lib/authUtils'
import prisma from '@/lib/prisma'
import { uploadToR2, deleteFromR2, buildArtworkVideoKey } from '@/lib/r2'

// 20MB max for video files
const MAX_VIDEO_SIZE = 20 * 1024 * 1024

// Allowed video MIME types (web-compatible)
const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4', // .mp4
  'video/webm', // .webm
])

// Map MIME types to file extensions
const MIME_TO_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

// POST - Upload video for artwork (requires auth + ownership)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Get the video file from form data
    const formData = await request.formData()
    const file = formData.get('video') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 })
    }

    // Check file size
    if (file.size > MAX_VIDEO_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 20MB.' }, { status: 400 })
    }

    // Validate video type
    if (!ALLOWED_VIDEO_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Accepted formats: MP4, WebM.' },
        { status: 400 },
      )
    }

    // Get file extension from MIME type
    const ext = MIME_TO_EXT[file.type] || 'mp4'

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Delete old video if exists
    if (artwork.videoUrl) {
      try {
        await deleteFromR2(artwork.videoUrl)
      } catch (error) {
        console.warn('Failed to delete old video:', error)
      }
    }

    // Upload to Cloudflare R2
    const key = await buildArtworkVideoKey(artwork.userId, id, ext)
    const url = await uploadToR2(key, buffer, file.type)

    // Update artwork with new video URL
    await prisma.artwork.update({
      where: { id },
      data: {
        videoUrl: url,
      },
    })

    // Bust cache
    revalidateTag(`artwork-${id}`, 'default')

    return NextResponse.json({
      url,
      size: buffer.length,
    })
  } catch (error) {
    console.error('[POST /api/artworks/[id]/video] error:', error)
    return NextResponse.json({ error: 'Failed to upload video' }, { status: 500 })
  }
}

// DELETE - Remove video from artwork (requires auth + ownership)
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

    if (!artwork.videoUrl) {
      return NextResponse.json({ message: 'No video to delete' })
    }

    // Delete from R2 (handles legacy Vercel Blob URLs gracefully)
    try {
      await deleteFromR2(artwork.videoUrl)
    } catch (error) {
      console.warn('Failed to delete video blob:', error)
    }

    // Update artwork
    await prisma.artwork.update({
      where: { id },
      data: { videoUrl: null },
    })

    // Bust cache
    revalidateTag(`artwork-${id}`, 'default')

    return NextResponse.json({ message: 'Video deleted' })
  } catch (error) {
    console.error('[DELETE /api/artworks/[id]/video] error:', error)
    return NextResponse.json({ error: 'Failed to delete video' }, { status: 500 })
  }
}
