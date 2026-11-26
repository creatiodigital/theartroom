import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

import { BUTTON_LABEL_MAX, BUTTON_LINK_ERROR, normalizeButtonLink } from '@/lib/announcementButton'
import { requireAdmin } from '@/lib/authUtils'
import prisma from '@/lib/prisma'
import { deleteFromR2 } from '@/lib/r2'

type RouteParams = { params: Promise<{ id: string }> }

const notFound = () => NextResponse.json({ error: 'Announcement not found' }, { status: 404 })

// GET one announcement (admin editor).
export async function GET(_request: Request, { params }: RouteParams) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError
  try {
    const { id } = await params
    const announcement = await prisma.announcement.findUnique({ where: { id } })
    return announcement ? NextResponse.json(announcement) : notFound()
  } catch (error) {
    console.error('[GET /api/announcements/[id]] error:', error)
    return NextResponse.json({ error: 'Failed to fetch announcement' }, { status: 500 })
  }
}

// PUT the title, text, on/off switch and the optional button (label + link). The photo has its own
// route (`./image`).
export async function PUT(request: Request, { params }: RouteParams) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError
  try {
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    const data: {
      title?: string
      content?: string
      isActive?: boolean
      buttonLabel?: string | null
      buttonUrl?: string | null
    } = {}
    if (typeof body.title === 'string') data.title = body.title
    if (typeof body.content === 'string') data.content = body.content
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive
    // The button (docs/take-a-peek T9): empty clears it; the link must be https://, a site path or
    // mailto: (the editor checks the same before saving).
    if (typeof body.buttonLabel === 'string') {
      data.buttonLabel = body.buttonLabel.trim().slice(0, BUTTON_LABEL_MAX) || null
    }
    if (typeof body.buttonUrl === 'string') {
      const link = normalizeButtonLink(body.buttonUrl)
      if (link === false) return NextResponse.json({ error: BUTTON_LINK_ERROR }, { status: 400 })
      data.buttonUrl = link
    }

    const exists = await prisma.announcement.findUnique({ where: { id }, select: { id: true } })
    if (!exists) return notFound()

    const announcement = await prisma.announcement.update({ where: { id }, data })
    revalidatePath('/')
    return NextResponse.json(announcement)
  } catch (error) {
    console.error('[PUT /api/announcements/[id]] error:', error)
    return NextResponse.json({ error: 'Failed to save announcement' }, { status: 500 })
  }
}

// DELETE an announcement and its photo.
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError
  try {
    const { id } = await params
    const announcement = await prisma.announcement.findUnique({ where: { id } })
    if (!announcement) return notFound()

    await prisma.announcement.delete({ where: { id } })
    if (announcement.imageUrl) {
      try {
        await deleteFromR2(announcement.imageUrl)
      } catch (error) {
        console.warn('Failed to delete announcement photo:', error)
      }
    }
    revalidatePath('/')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/announcements/[id]] error:', error)
    return NextResponse.json({ error: 'Failed to delete announcement' }, { status: 500 })
  }
}
