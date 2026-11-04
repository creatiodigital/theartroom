import { captureError } from '@/lib/observability/captureError'
import prisma from '@/lib/prisma'

export type HomepageAnnouncement = {
  id: string
  title: string
  /** TipTap HTML; `RichText` sanitizes it when it renders. */
  content: string
  imageUrl: string
}

/**
 * The announcement the homepage shows (AR-174): the newest that is switched on and has a title and
 * a photo. Null when there is none, and the section is hidden.
 *
 * FAILS SOFT: if the read fails (say a release lands before the production database has the
 * table), the homepage simply shows no announcement rather than an error.
 */
export async function getHomepageAnnouncement(): Promise<HomepageAnnouncement | null> {
  try {
    const rows = await prisma.announcement.findMany({
      where: { isActive: true, imageUrl: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, content: true, imageUrl: true },
      take: 10,
    })
    const shown = rows.find((row) => row.imageUrl && row.title.trim())
    return shown ? { ...shown, title: shown.title.trim(), imageUrl: shown.imageUrl! } : null
  } catch (err) {
    captureError(err, { flow: 'content', stage: 'homepage-announcement', level: 'warning' })
    return null
  }
}
