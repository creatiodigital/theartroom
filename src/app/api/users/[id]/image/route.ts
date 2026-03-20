import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { requireOwnership } from '@/lib/authUtils'
import { processImage, isValidImageType } from '@/lib/imageProcessor'
import prisma from '@/lib/prisma'
import { uploadToR2, deleteFromR2, buildProfileImageKey } from '@/lib/r2'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB for profile images

// POST - Upload profile image (requires auth + ownership)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Verify user can only update their own profile
    const { error: authError } = await requireOwnership(id)
    if (authError) return authError

    const user = await prisma.user.findUnique({
      where: { id },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (!isValidImageType(buffer)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a JPG, PNG, WebP, or GIF image.' },
        { status: 400 },
      )
    }

    const processedBuffer = await processImage(buffer)

    // Delete old image if exists
    if (user.profileImageUrl) {
      try {
        await deleteFromR2(user.profileImageUrl)
      } catch (error) {
        console.warn('Failed to delete old profile image:', error)
      }
    }

    // Upload to Cloudflare R2
    const key = await buildProfileImageKey(id)
    const url = await uploadToR2(key, processedBuffer, 'image/webp')

    // Update user with new image URL
    await prisma.user.update({
      where: { id },
      data: { profileImageUrl: url },
    })

    return NextResponse.json({ url })
  } catch (error) {
    console.error('[POST /api/users/[id]/image] error:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}

// DELETE - Remove profile image (requires auth + ownership)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    // Verify user can only delete their own profile image
    const { error: authError } = await requireOwnership(id)
    if (authError) return authError

    const user = await prisma.user.findUnique({
      where: { id },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.profileImageUrl) {
      return NextResponse.json({ message: 'No image to delete' })
    }

    try {
      await deleteFromR2(user.profileImageUrl)
    } catch (error) {
      console.warn('Failed to delete blob:', error)
    }

    await prisma.user.update({
      where: { id },
      data: { profileImageUrl: null },
    })

    return NextResponse.json({ message: 'Image deleted' })
  } catch (error) {
    console.error('[DELETE /api/users/[id]/image] error:', error)
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 })
  }
}
