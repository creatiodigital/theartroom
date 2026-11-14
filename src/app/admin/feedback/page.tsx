import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { auth } from '@/auth'
import {
  AdminFeedback,
  type FeedbackFilter,
  type FeedbackRow,
} from '@/components/admin/feedback/AdminFeedback'
import { isAdminOrAbove } from '@/lib/authUtils'
import { receivedLabel } from '@/lib/feedback/receivedLabel'
import prisma from '@/lib/prisma'

export const metadata: Metadata = {
  title: { absolute: 'Feedback — The Art Room Admin' },
  robots: { index: false, follow: false },
}

// Always the stored list as it is now (and "Today" as of now).
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

type AdminFeedbackPageProps = {
  searchParams: Promise<{ from?: string; page?: string }>
}

/**
 * Admin · Gallery › Feedback (F1, docs/admin-redesign/feedback-list.md): every visitor feedback,
 * newest first, filtered by where it came from, 50 a page. Read here, on the server: the proxy
 * lets only admins into /admin, and this page checks again before reading anything.
 */
export default async function AdminFeedbackPage({ searchParams }: AdminFeedbackPageProps) {
  const session = await auth()
  if (!isAdminOrAbove(session?.user?.userType)) notFound()

  const { from, page } = await searchParams
  const filter: FeedbackFilter = from === 'home' || from === 'room' ? from : 'all'
  const where = filter === 'all' ? {} : { source: filter }

  const [total, anyFeedback] = await Promise.all([
    prisma.feedback.count({ where }),
    filter === 'all' ? null : prisma.feedback.count(),
  ])
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const current = Math.min(pages, Math.max(1, Number.parseInt(page ?? '1', 10) || 1))

  const stored = await prisma.feedback.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (current - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      message: true,
      source: true,
      createdAt: true,
      exhibition: { select: { mainTitle: true, url: true, user: { select: { handler: true } } } },
    },
  })

  const now = new Date()
  const rows: FeedbackRow[] = stored.map((feedback) => ({
    id: feedback.id,
    message: feedback.message,
    source: feedback.source === 'room' ? 'room' : 'home',
    received: receivedLabel(feedback.createdAt, now),
    exhibition: feedback.exhibition
      ? {
          title: feedback.exhibition.mainTitle,
          href: `/exhibitions/${encodeURIComponent(feedback.exhibition.user.handler)}/${encodeURIComponent(feedback.exhibition.url)}`,
        }
      : null,
  }))

  return (
    <AdminFeedback
      rows={rows}
      filter={filter}
      total={total}
      anyFeedback={(anyFeedback ?? total) > 0}
      page={current}
      pages={pages}
    />
  )
}
