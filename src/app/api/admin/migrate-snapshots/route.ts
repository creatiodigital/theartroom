import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { Prisma } from '@/generated/prisma'
import prisma from '@/lib/prisma'
import { buildExhibitionSnapshot } from '@/lib/exhibitionSnapshot'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/migrate-snapshots
 *
 * One-time migration: generates publishedSnapshot for all currently-published
 * exhibitions that don't already have one.
 * Restricted to superAdmin only.
 */
export async function POST() {
  try {
    const session = await auth()
    if (session?.user?.userType !== 'superAdmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Find all published exhibitions without a snapshot
    const exhibitions = await prisma.exhibition.findMany({
      where: {
        published: true,
        publishedSnapshot: { equals: Prisma.DbNull },
      },
      select: { id: true, mainTitle: true },
    })

    const results: { id: string; mainTitle: string; status: string }[] = []

    for (const ex of exhibitions) {
      try {
        const snapshot = await buildExhibitionSnapshot(ex.id)
        await prisma.exhibition.update({
          where: { id: ex.id },
          data: {
            publishedSnapshot: snapshot,
            publishedAt: new Date(),
            hasPendingChanges: false,
          },
        })
        results.push({ id: ex.id, mainTitle: ex.mainTitle, status: 'success' })
      } catch (err) {
        console.error(`Failed to migrate snapshot for ${ex.id}:`, err)
        results.push({ id: ex.id, mainTitle: ex.mainTitle, status: 'failed' })
      }
    }

    return NextResponse.json({
      message: `Migrated ${results.filter((r) => r.status === 'success').length}/${exhibitions.length} exhibitions`,
      results,
    })
  } catch (error) {
    console.error('[POST /api/admin/migrate-snapshots] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
