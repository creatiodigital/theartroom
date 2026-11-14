'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash } from '@phosphor-icons/react'

import { AdminConfirmModal } from '@/components/admin/ui/AdminConfirmModal'
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader'
import { DataTable } from '@/components/admin/ui/DataTable'
import { EmptyState } from '@/components/admin/ui/EmptyState'
import { FeedbackBar } from '@/components/admin/ui/FeedbackBar'
import { ListPanel } from '@/components/admin/ui/ListPanel'
import { SegmentedControl } from '@/components/admin/ui/SegmentedControl'
import { StatusPill } from '@/components/admin/ui/StatusPill'
import { Button } from '@/components/ui/Button'

import styles from './AdminFeedback.module.scss'

const PAGE_PATH = '/admin/feedback'

export type FeedbackFilter = 'all' | 'home' | 'room'

/** One stored feedback, as the server page hands it over (plain values only). */
export type FeedbackRow = {
  id: string
  /** The visitor's text: always rendered as text, never as HTML. */
  message: string
  source: 'home' | 'room'
  /** "Today, 09:42" (lib/feedback/receivedLabel, Europe/Madrid). */
  received: string
  /** The room it was sent from (null: the home page, or a room since deleted). */
  exhibition: { title: string; href: string } | null
}

type AdminFeedbackProps = {
  rows: FeedbackRow[]
  filter: FeedbackFilter
  /** Messages under the filter, every page. */
  total: number
  /** Any feedback at all, whatever the filter. */
  anyFeedback: boolean
  page: number
  pages: number
}

const FILTERS: { id: FeedbackFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'home', label: 'Home page' },
  { id: 'room', label: '3D rooms' },
]

const messagesCount = (n: number) => `${n} ${n === 1 ? 'message' : 'messages'}`

const hrefFor = (filter: FeedbackFilter, page = 1) => {
  const params = new URLSearchParams()
  if (filter !== 'all') params.set('from', filter)
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  return query ? `${PAGE_PATH}?${query}` : PAGE_PATH
}

/** The server's own `{ error }` text when it sends one. */
const serverError = async (response: Response) => {
  const data: unknown = await response.json().catch(() => null)
  return data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
    ? data.error
    : "Couldn't delete this feedback. Please try again."
}

/**
 * Admin · Gallery › Feedback (F1, docs/admin-redesign/feedback-list.md; designs/admin-feedback-
 * list and -states): every visitor feedback, newest first, filtered by where it came from, and a
 * Delete on each row that asks first. The list comes from the server page; a delete refreshes it.
 */
export function AdminFeedback({
  rows,
  filter,
  total,
  anyFeedback,
  page,
  pages,
}: AdminFeedbackProps) {
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<FeedbackRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  // Rows deleted here: gone at once, before the refreshed list arrives.
  const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => setSuccess(''), 4000)
    return () => clearTimeout(timer)
  }, [success])

  const setFilter = useCallback(
    (next: FeedbackFilter) => router.replace(hrefFor(next), { scroll: false }),
    [router],
  )

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch(`/api/admin/feedback/${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE',
      })
      // Gone already (another tab): the row goes too, and the bar says why.
      if (response.ok || response.status === 404) {
        setDeletedIds((ids) => new Set(ids).add(deleteTarget.id))
      }
      if (response.ok) setSuccess('Feedback deleted.')
      else setError(await serverError(response))
      router.refresh()
    } catch {
      setError("Couldn't delete this feedback. Please try again.")
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }, [deleteTarget, router])

  const visible = rows.filter((row) => !deletedIds.has(row.id))
  const shownTotal = total - (rows.length - visible.length)

  return (
    <div className={styles.page}>
      <AdminPageHeader
        eyebrow="Gallery"
        title="Feedback"
        description="What visitors send from the home page and the 3D rooms, newest first. Each message is also emailed to contact@theartroom.gallery."
      />

      {success && (
        <FeedbackBar tone="success" onDismiss={() => setSuccess('')}>
          {success}
        </FeedbackBar>
      )}
      {error && (
        <FeedbackBar tone="error" onDismiss={() => setError('')}>
          {error}
        </FeedbackBar>
      )}

      <ListPanel
        label="Feedback"
        toolbar={
          anyFeedback ? (
            <div className={styles.filters}>
              <SegmentedControl
                label="From"
                options={FILTERS}
                value={filter}
                onChange={setFilter}
              />
            </div>
          ) : undefined
        }
        count={anyFeedback ? messagesCount(shownTotal) : undefined}
      >
        {!anyFeedback ? (
          <EmptyState
            title="No feedback yet"
            text="Messages from the home page and the 3D rooms will appear here."
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title={
              filter === 'home' ? 'No feedback from the home page' : 'No feedback from the 3D rooms'
            }
          />
        ) : (
          <DataTable className={styles.table}>
            <thead>
              <tr>
                <th scope="col" className={styles.receivedHead}>
                  Received
                </th>
                <th scope="col" className={styles.fromHead}>
                  From
                </th>
                <th scope="col">Message</th>
                <th scope="col" className={styles.actionsHead}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className={styles.row}>
                  <td className={styles.cellReceived}>{row.received}</td>
                  <td className={styles.cellFrom}>
                    <span className={styles.from}>
                      {row.source === 'room' ? (
                        <StatusPill tone="info" label="3D room" />
                      ) : (
                        <StatusPill tone="gray" label="Home page" />
                      )}
                      {row.source === 'room' && row.exhibition && (
                        <Link href={row.exhibition.href} className={styles.exhibition}>
                          {row.exhibition.title}
                        </Link>
                      )}
                    </span>
                  </td>
                  <td className={styles.cellMessage}>
                    {/* Text, never HTML: React escapes it; line breaks are kept by CSS. */}
                    <p className={styles.message}>{row.message}</p>
                  </td>
                  <td className={styles.cellAction}>
                    <Button
                      variant="bare"
                      font="dashboard"
                      className={styles.delete}
                      aria-label="Delete this feedback"
                      onClick={() => {
                        setError('')
                        setDeleteTarget(row)
                      }}
                    >
                      <Trash size={16} weight="light" aria-hidden />
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}

        {/* 50 a page (feedback-list.md): no shared admin pager exists yet (questions.md). */}
        {pages > 1 && (
          <nav aria-label="Feedback pages" className={styles.pager}>
            {page > 1 ? (
              <Link href={hrefFor(filter, page - 1)} className={styles.pagerLink}>
                ← Newer
              </Link>
            ) : (
              <span />
            )}
            <span className={styles.pagerStatus}>
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link href={hrefFor(filter, page + 1)} className={styles.pagerLink}>
                Older →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </ListPanel>

      {deleteTarget && (
        <AdminConfirmModal
          title="Delete this feedback?"
          message={
            <>
              <p className={styles.quote}>“{deleteTarget.message}”</p>
              <p>It is removed for good. The email you received stays in your inbox.</p>
            </>
          }
          confirmLabel="Delete"
          busyLabel="Deleting…"
          destructive
          busy={deleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
