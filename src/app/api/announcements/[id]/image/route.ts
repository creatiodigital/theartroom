import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/authUtils'
import { MAX_UPLOAD_SIZE } from '@/lib/imageConfig'
import { processImage, isValidImageType } from '@/lib/imageProcessor'
import prisma from '@/lib/prisma'
import { uploadToR2, deleteFromR2, buildAnnouncementImageKey } from '@/lib/r2'

type RouteParams = { params: Promise<{ id: string }> }

// POST - the announcement's photo: processed like a slide's (WebP), stored under this
// environment's prefix, and the previous one deleted.
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError
  try {
    const { id } = await params
    const announcement = await prisma.announcement.findUnique({ where: { id } })
    if (!announcement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('image') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (!isValidImageType(buffer)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a JPG, PNG, WebP, or GIF image.' },
        { status: 400 },
      )
    }
    const processed = await processImage(buffer)

    if (announcement.imageUrl) {
      try {
        await deleteFromR2(announcement.imageUrl)
      } catch (error) {
        console.warn('Failed to delete previous announcement photo:', error)
      }
    }

    const url = await uploadToR2(buildAnnouncementImageKey(id), processed, 'image/webp')
    await prisma.announcement.update({ where: { id }, data: { imageUrl: url } })
    revalidatePath('/')
    return NextResponse.json({ url })
  } catch (error) {
    console.error('[POST /api/announcements/[id]/image] error:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}

// DELETE - remove the photo (the announcement then stops showing on the homepage).
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError
  try {
    const { id } = await params
    const announcement = await prisma.announcement.findUnique({ where: { id } })
    if (!announcement) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })
    }
    if (announcement.imageUrl) {
      try {
        await deleteFromR2(announcement.imageUrl)
      } catch (error) {
        console.warn('Failed to delete announcement photo:', error)
      }
    }
    await prisma.announcement.update({ where: { id }, data: { imageUrl: null } })
    revalidatePath('/')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/announcements/[id]/image] error:', error)
    return NextResponse.json({ error: 'Failed to remove image' }, { status: 500 })
  }
}
