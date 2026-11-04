import { NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

// Admin → Content → Announcements (AR-174). The homepage reads its one announcement straight from
// the database (`getHomepageAnnouncement`), never through here, so every route is admin-only.

// GET every announcement, newest first.
export async function GET() {
  const { error: authError } = await requireAdmin()
  if (authError) return authError
  try {
    const announcements = await prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(announcements)
  } catch (error) {
    console.error('[GET /api/announcements] error:', error)
    return NextResponse.json({ error: 'Failed to fetch announcements' }, { status: 500 })
  }
}

// POST a new, empty, hidden announcement. The editor fills it in (it needs the id to upload the
// photo), and it shows on the homepage only once it's switched on.
export async function POST() {
  const { error: authError } = await requireAdmin()
  if (authError) return authError
  try {
    const announcement = await prisma.announcement.create({ data: {} })
    return NextResponse.json(announcement, { status: 201 })
  } catch (error) {
    console.error('[POST /api/announcements] error:', error)
    return NextResponse.json({ error: 'Failed to create announcement' }, { status: 500 })
  }
}
