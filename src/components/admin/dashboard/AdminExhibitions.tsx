'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

type Exhibition = {
  id: string
  mainTitle: string
  url: string
  handler: string
  status: string
  published: boolean
  user: {
    id: string
    name: string
    lastName: string
    handler: string
  }
}

export const AdminExhibitions = () => {
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Exhibition | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmText, setConfirmText] = useState('')

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

  const handleTogglePublished = async (exhibitionId: string, currentPublished: boolean) => {
    const newPublished = !currentPublished
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: newPublished }),
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
              <th>Published</th>
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
                  <div className={dashboardStyles.actions}>
                    <Button
                      font="dashboard"
                      variant="secondary"
                      label={exhibition.status === 'current' ? 'Mark Past' : 'Mark Current'}
                      onClick={() => handleToggleStatus(exhibition.id, exhibition.status)}
                    />
                    <Button
                      font="dashboard"
                      variant="secondary"
                      label={exhibition.published ? 'Unpublish' : 'Publish'}
                      onClick={() => handleTogglePublished(exhibition.id, exhibition.published)}
                    />
                    <Button
                      font="dashboard"
                      variant="secondary"
                      label="Delete"
                      onClick={() => setDeleteTarget(exhibition)}
                    />
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
