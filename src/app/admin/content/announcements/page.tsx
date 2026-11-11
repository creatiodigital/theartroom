'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PencilSimple, Plus, Trash } from '@phosphor-icons/react'

import { AdminBreadcrumb } from '@/components/admin/ui/AdminBreadcrumb'
import { AdminConfirmModal } from '@/components/admin/ui/AdminConfirmModal'
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader'
import { Callout } from '@/components/admin/ui/Callout'
import { EmptyState } from '@/components/admin/ui/EmptyState'
import { ListPanel } from '@/components/admin/ui/ListPanel'
import { StatusPill } from '@/components/admin/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { LoadingBar } from '@/components/ui/LoadingBar'

import styles from './page.module.scss'
import { useAdminGate } from './useAdminGate'

type AnnouncementRow = {
  id: string
  title: string
  imageUrl: string | null
  isActive: boolean
  createdAt: string
}

/** What the homepage needs to show an announcement: switched on, a title and a photo. */
const showable = (a: AnnouncementRow) => a.isActive && !!a.title.trim() && !!a.imageUrl

const announcementsCount = (n: number) => (n === 1 ? '1 announcement' : `${n} announcements`)

/**
 * Admin → Content → Announcements (AR-174). The homepage shows the newest announcement that is
 * switched on and has a title and a photo; this list says which one that is.
 */
export default function AnnouncementsAdminPage() {
  const router = useRouter()
  const { loading: sessionLoading, isAdmin } = useAdminGate()
  const [rows, setRows] = useState<AnnouncementRow[] | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<AnnouncementRow | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/announcements')
      if (!response.ok) throw new Error()
      setRows(await response.json())
    } catch {
      setError('The announcements could not be loaded.')
    }
  }, [])

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin, load])

  const create = async () => {
    setCreating(true)
    setError('')
    try {
      const response = await fetch('/api/announcements', { method: 'POST' })
      if (!response.ok) throw new Error()
      const { id } = (await response.json()) as { id: string }
      router.push(`/admin/content/announcements/${id}`)
    } catch {
      setError('The announcement could not be created.')
      setCreating(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      const response = await fetch(`/api/announcements/${deleting.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error()
      setDeleting(null)
      await load()
    } catch {
      setError('The announcement could not be deleted.')
      setDeleting(null)
    } finally {
      setBusy(false)
    }
  }

  if (sessionLoading || !isAdmin) {
    return (
      <div className={styles.page}>
        <LoadingBar />
      </div>
    )
  }

  const shownId = rows?.find(showable)?.id

  // Today's Status cell rule, verbatim.
  const statusOf = (row: AnnouncementRow) =>
    row.id === shownId
      ? 'On the homepage'
      : !row.isActive
        ? 'Off'
        : showable(row)
          ? 'On (a newer one shows)'
          : 'On, but needs a title and a photo'

  return (
    <div className={styles.page}>
      {/* gallery.md §2 (Q4): Content / Announcements, in place of an eyebrow. */}
      <AdminBreadcrumb
        items={[{ label: 'Content', href: '/admin/content' }, { label: 'Announcements' }]}
      />
      <AdminPageHeader
        title="Announcements"
        description="Only the newest switched-on announcement with a title and a photo shows on the homepage."
        actions={
          <Button
            variant="bare"
            font="dashboard"
            className={styles.add}
            onClick={create}
            disabled={creating}
          >
            <Plus size={16} weight="light" aria-hidden />
            {creating ? 'Creating…' : 'New announcement'}
          </Button>
        }
      />

      {/* No ×: a dismissed load error would bring the loading bar back (Q75). */}
      {error && (
        <Callout tone="red" role="alert">
          {error}
        </Callout>
      )}

      {rows === null ? (
        !error && <LoadingBar />
      ) : (
        <ListPanel
          label="Announcements"
          count={rows.length > 0 ? announcementsCount(rows.length) : undefined}
          footnote="Shown between the introduction and Current Exhibitions. With none, the section is hidden."
        >
          {rows.length === 0 ? (
            <EmptyState title="No announcements yet." />
          ) : (
            <ul className={styles.list}>
              {rows.map((row) => {
                const title = row.title.trim() || 'Untitled'
                const shown = row.id === shownId
                return (
                  <li key={row.id} className={styles.row}>
                    {row.imageUrl ? (
                      <img src={row.imageUrl} alt="" className={styles.thumb} />
                    ) : (
                      <span className={`${styles.thumb} ${styles.noPhoto}`}>No photo</span>
                    )}
                    <div className={styles.text}>
                      <span className={row.title.trim() ? styles.title : styles.untitled}>
                        {title}
                      </span>
                      <span>
                        <StatusPill
                          shape="tag"
                          tone={shown ? 'green' : 'gray'}
                          label={statusOf(row)}
                        />
                      </span>
                    </div>
                    <div className={styles.actions}>
                      <Button
                        variant="bare"
                        font="dashboard"
                        className={styles.edit}
                        href={`/admin/content/announcements/${row.id}`}
                      >
                        <PencilSimple size={16} weight="light" aria-hidden />
                        Edit
                      </Button>
                      <Button
                        variant="bare"
                        font="dashboard"
                        className={styles.trash}
                        aria-label={`Delete announcement ${title}`}
                        onClick={() => setDeleting(row)}
                      >
                        <Trash size={16} weight="light" aria-hidden />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </ListPanel>
      )}

      {deleting && (
        <AdminConfirmModal
          title="Delete this announcement?"
          message={`"${deleting.title.trim() || 'Untitled'}" and its photo will be deleted. This can't be undone.`}
          confirmLabel="Delete"
          busyLabel="Deleting…"
          destructive
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
