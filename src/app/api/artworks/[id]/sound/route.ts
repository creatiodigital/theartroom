import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'

import { requireOwnership } from '@/lib/authUtils'
import prisma from '@/lib/prisma'
import { uploadToR2, deleteFromR2, buildArtworkSoundKey } from '@/lib/r2'

// 3MB max for audio files
const MAX_SOUND_SIZE = 3 * 1024 * 1024

// Allowed audio MIME types (web-compatible)
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/mpeg', // .mp3
  'audio/mp4', // .m4a, .mp4 audio
  'audio/ogg', // .ogg
  'audio/webm', // .webm audio
  'audio/wav', // .wav
  'audio/x-wav', // .wav (alternate MIME)
  'audio/aac', // .aac
  'audio/flac', // .flac
])

// Map MIME types to file extensions
const MIME_TO_EXT: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/aac': 'aac',
  'audio/flac': 'flac',
}

// POST - Upload sound for artwork (requires auth + ownership)
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

    // Get the sound file from form data
    const formData = await request.formData()
    const file = formData.get('sound') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No sound file provided' }, { status: 400 })
    }

    // Check file size
    if (file.size > MAX_SOUND_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 3MB.' }, { status: 400 })
    }

    // Validate audio type
    if (!ALLOWED_AUDIO_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Accepted formats: MP3, M4A, OGG, WebM, WAV, AAC, FLAC.' },
        { status: 400 },
      )
    }

    // Get file extension from MIME type
    const ext = MIME_TO_EXT[file.type] || 'mp3'

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Delete old sound if exists
    if (artwork.soundUrl) {
      try {
        await deleteFromR2(artwork.soundUrl)
      } catch (error) {
        console.warn('Failed to delete old sound:', error)
      }
    }

    // Upload to Cloudflare R2
    const key = await buildArtworkSoundKey(artwork.userId, id, ext)
    const url = await uploadToR2(key, buffer, file.type)

    // Update artwork with new sound URL
    await prisma.artwork.update({
      where: { id },
      data: {
        soundUrl: url,
      },
    })

    // Bust cache
    revalidateTag(`artwork-${id}`, 'default')

    return NextResponse.json({
      url,
      size: buffer.length,
    })
  } catch (error) {
    console.error('[POST /api/artworks/[id]/sound] error:', error)
    return NextResponse.json({ error: 'Failed to upload sound' }, { status: 500 })
  }
}

// DELETE - Remove sound from artwork (requires auth + ownership)
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

    if (!artwork.soundUrl) {
      return NextResponse.json({ message: 'No sound to delete' })
    }

    // Delete from R2 (handles legacy Vercel Blob URLs gracefully)
    try {
      await deleteFromR2(artwork.soundUrl)
    } catch (error) {
      console.warn('Failed to delete sound blob:', error)
    }

    // Update artwork
    await prisma.artwork.update({
      where: { id },
      data: { soundUrl: null },
    })

    // Bust cache
    revalidateTag(`artwork-${id}`, 'default')

    return NextResponse.json({ message: 'Sound deleted' })
  } catch (error) {
    console.error('[DELETE /api/artworks/[id]/sound] error:', error)
    return NextResponse.json({ error: 'Failed to delete sound' }, { status: 500 })
  }
}
