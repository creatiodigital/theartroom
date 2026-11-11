'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
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
      <div className={dashboardStyles.page}>
        <LoadingBar />
      </div>
    )
  }

  const shownId = rows?.find(showable)?.id

  return (
    <>
      <h1 className={dashboardStyles.pageTitle}>Announcements</h1>

      <div className={dashboardStyles.section}>
        <div className={dashboardStyles.sectionHeader}>
          <h2 className={dashboardStyles.sectionTitle}>Homepage announcements</h2>
          <Button
            font="dashboard"
            variant="primary"
            label={creating ? 'Creating...' : 'New Announcement'}
            onClick={create}
            disabled={creating}
          />
        </div>
        <p className={dashboardStyles.sectionDescription}>
          Shown on the homepage between the introduction and Current Exhibitions. Only one shows:
          the newest that is switched on and has a title and a photo. With none, the section is
          hidden.
        </p>

        {error && <p className={styles.error}>{error}</p>}

        {rows === null ? (
          !error && <LoadingBar />
        ) : rows.length === 0 ? (
          <p className={dashboardStyles.sectionDescription}>No announcements yet.</p>
        ) : (
          <table className={dashboardStyles.table}>
            <thead>
              <tr>
                <th>Photo</th>
                <th>Title</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.imageUrl ? (
                      <img src={row.imageUrl} alt="" className={styles.thumbnail} />
                    ) : (
                      <span className={styles.noPhoto}>No photo</span>
                    )}
                  </td>
                  <td>{row.title.trim() || <span className={styles.untitled}>Untitled</span>}</td>
                  <td>
                    {row.id === shownId
                      ? 'On the homepage'
                      : !row.isActive
                        ? 'Off'
                        : showable(row)
                          ? 'On (a newer one shows)'
                          : 'On, but needs a title and a photo'}
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <Button
                        font="dashboard"
                        variant="secondary"
                        size="small"
                        label="Edit"
                        href={`/admin/content/announcements/${row.id}`}
                      />
                      <Button
                        font="dashboard"
                        variant="ghost"
                        size="small"
                        label="Delete"
                        onClick={() => setDeleting(row)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {deleting && (
        <ConfirmModal
          title="Delete this announcement?"
          message={`"${deleting.title.trim() || 'Untitled'}" and its photo will be deleted. This can't be undone.`}
          confirmLabel="Delete"
          destructive
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  )
}
