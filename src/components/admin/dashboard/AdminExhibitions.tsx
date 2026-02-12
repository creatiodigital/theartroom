'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { MoreVertical } from 'lucide-react'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'

type Exhibition = {
  id: string
  mainTitle: string
  url: string
  handler: string
  status: string
  published: boolean
  hasPendingChanges: boolean
  user: {
    id: string
    name: string
    lastName: string
    handler: string
    published?: boolean
  }
}

export const AdminExhibitions = () => {
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Exhibition | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close kebab menu on outside click
  useEffect(() => {
    if (!openMenuId) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenuId])

  const fetchExhibitions = useCallback(async () => {
    try {
      const response = await fetch('/api/exhibitions')
      if (response.ok) {
        const data = await response.json()
        setExhibitions(data)
      }
    } catch (error) {
      console.error('Failed to fetch exhibitions:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchExhibitions()
  }, [fetchExhibitions])

  const handleToggleStatus = async (exhibitionId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'current' ? 'past' : 'current'
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (response.ok) {
        fetchExhibitions()
      }
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  const handlePublishAction = async (exhibitionId: string, action: 'publish' | 'unpublish') => {
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: action === 'publish' }),
      })
      if (response.ok) {
        fetchExhibitions()
      }
    } catch (error) {
      console.error('Failed to update published status:', error)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/exhibitions/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        fetchExhibitions()
        setDeleteTarget(null)
        setConfirmText('')
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete exhibition')
      }
    } catch (error) {
      console.error('Failed to delete exhibition:', error)
      alert('Failed to delete exhibition')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <div>Loading exhibitions...</div>

  return (
    <>
      <div className={dashboardStyles.section}>
        <div className={dashboardStyles.sectionHeader}>
          <h2 className={dashboardStyles.sectionTitle}>Exhibition Management</h2>
        </div>

        <table className={dashboardStyles.table}>
          <thead>
            <tr>
              <th>Exhibition</th>
              <th>Artist</th>
              <th>Status</th>
              <th>Visibility</th>
              <th>Review</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {exhibitions.map((exhibition) => (
              <tr key={exhibition.id}>
                <td>
                  <Link
                    href={`/exhibitions/${exhibition.user.handler}/${exhibition.url}`}
                  >
                    {exhibition.mainTitle}
                  </Link>
                </td>
                <td>
                  {exhibition.user.name} {exhibition.user.lastName}
                </td>
                <td>
                  <Badge
                    label={exhibition.status}
                    variant={exhibition.status as 'current' | 'past'}
                  />
                </td>
                <td>
                  <Badge
                    label={exhibition.published ? 'Published' : 'Unpublished'}
                    variant={exhibition.published ? 'published' : 'unpublished'}
                  />
                </td>
                <td>
                  {exhibition.published && (
                    <Badge
                      label={exhibition.hasPendingChanges ? 'Needs Review' : 'Up to date'}
                      variant={exhibition.hasPendingChanges ? 'current' : 'published'}
                    />
                  )}
                </td>
                <td>
                  <div className={dashboardStyles.kebabWrapper} ref={openMenuId === exhibition.id ? menuRef : undefined}>
                    <button
                      className={dashboardStyles.kebabButton}
                      onClick={() => setOpenMenuId(openMenuId === exhibition.id ? null : exhibition.id)}
                      aria-label="Actions"
                    >
                      <MoreVertical size={16} strokeWidth={ICON_STROKE_WIDTH} />
                    </button>
                    {openMenuId === exhibition.id && (
                      <div className={dashboardStyles.kebabMenu}>
                        <button className={dashboardStyles.kebabMenuItem} onClick={() => { setOpenMenuId(null); handleToggleStatus(exhibition.id, exhibition.status); }}>
                          {exhibition.status === 'current' ? 'Mark Past' : 'Mark Current'}
                        </button>
                        {/* Publish / Update Exhibition */}
                        {(!exhibition.published || exhibition.hasPendingChanges) && (
                          <button
                            className={dashboardStyles.kebabMenuItem}
                            onClick={() => { setOpenMenuId(null); handlePublishAction(exhibition.id, 'publish'); }}
                            disabled={!exhibition.published && !exhibition.user.published}
                          >
                            {exhibition.published && exhibition.hasPendingChanges ? 'Update Exhibition' : 'Publish'}
                          </button>
                        )}
                        {/* Unpublish — always available when published */}
                        {exhibition.published && (
                          <button
                            className={dashboardStyles.kebabMenuItem}
                            onClick={() => { setOpenMenuId(null); handlePublishAction(exhibition.id, 'unpublish'); }}
                          >
                            Unpublish
                          </button>
                        )}
                        <button className={`${dashboardStyles.kebabMenuItem} ${dashboardStyles.kebabMenuItemDanger}`} onClick={() => { setOpenMenuId(null); setDeleteTarget(exhibition); }}>
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal onClose={() => { setDeleteTarget(null); setConfirmText(''); }}>
          <div className={dashboardStyles.deleteModal}>
            <h2>Delete Exhibition</h2>
            <p>
              Are you sure you want to delete <strong>{deleteTarget.mainTitle}</strong> by{' '}
              {deleteTarget.user.name} {deleteTarget.user.lastName}?
            </p>
            <div className={dashboardStyles.deleteWarning}>
              This action is not reversible. Please be certain.
            </div>
            <div className={dashboardStyles.confirmInput}>
              <label htmlFor="confirm-delete">Type <strong>CONFIRM</strong> to enable deletion:</label>
              <Input
                id="confirm-delete"
                type="text"
                variant="table"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
            </div>
            <div className={dashboardStyles.deleteActions}>
              <Button
                font="dashboard"
                variant="secondary"
                label="Cancel"
                onClick={() => { setDeleteTarget(null); setConfirmText(''); }}
              />
              <Button
                font="dashboard"
                variant="primary"
                label={deleting ? 'Deleting...' : 'Delete'}
                onClick={handleDeleteConfirm}
                disabled={deleting || confirmText !== 'CONFIRM'}
              />
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
