'use client'

import { useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { AddArtistModal } from '@/components/admin/AddArtistModal'
import { AdminExhibitions } from '@/components/admin/dashboard/AdminExhibitions'
import { ContentManagement } from '@/components/admin/dashboard/ContentManagement'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { Modal } from '@/components/ui/Modal'
import { useEffectiveUser } from '@/hooks/useEffectiveUser'
import { useUsers } from '@/hooks/useUsers'
import type { TUser } from '@/types/user'

export const DashboardAdmin = () => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const { users, loading, error, refetch } = useUsers()
  const { startImpersonation } = useEffectiveUser()

  const [editingUsers, setEditingUsers] = useState<Record<string, TUser>>({})
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Redirect non-admins
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    } else if (sessionStatus === 'authenticated') {
      const userType = session?.user?.userType
      if (userType !== 'admin' && userType !== 'superAdmin') {
        router.push('/')
      }
    }
  }, [sessionStatus, session, router])

  const handleChange = (id: string, field: keyof TUser, value: string) => {
    setEditingUsers((prev) => {
      const current = prev[id] ?? users.find((a) => a.id === id)
      if (!current) return prev

      return {
        ...prev,
        [id]: {
          ...current,
          [field]: value,
        },
      }
    })
  }

  const getFieldValue = (user: TUser, field: keyof TUser): string => {
    return (editingUsers[user.id]?.[field] as string) ?? (user[field] as string) ?? ''
  }

  const handleAddSuccess = useCallback(() => {
    refetch()
  }, [refetch])

  const handleDeleteClick = useCallback((userId: string, userName: string) => {
    setDeleteTarget({ id: userId, name: userName })
  }, [])

  const handleImpersonate = useCallback(
    async (user: TUser) => {
      const fullName = `${user.name} ${user.lastName}`.trim()
      const success = await startImpersonation({
        id: user.id,
        name: fullName,
        handler: user.handler,
      })
      if (success) {
        router.push('/dashboard')
        router.refresh()
      }
    },
    [startImpersonation, router],
  )

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/users/${deleteTarget.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        refetch()
        setDeleteTarget(null)
      } else {
        alert('Failed to delete user')
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete user')
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, refetch])

  // Loading states
  if (sessionStatus === 'loading' || loading)
    return (
      <div className={dashboardStyles.page}>
        <LoadingBar />
      </div>
    )

  // Not authorized
  const userType = session?.user?.userType
  if (sessionStatus === 'unauthenticated' || (userType !== 'admin' && userType !== 'superAdmin')) {
    return <div className={dashboardStyles.page}>Not authorized</div>
  }

  const isSuperAdminUser = userType === 'superAdmin'

  if (error) return <div className={dashboardStyles.page}>Error: {error}</div>

  return (
    <DashboardLayout
      headerActions={
        <Button font="dashboard" variant="secondary" label="Test Dashboard" onClick={() => router.push('/dashboard')} />
      }
    >
      {/* Page Title */}
      <h1 className={dashboardStyles.pageTitle}>Admin Dashboard</h1>

      {/* Users Section */}
      <div className={dashboardStyles.section}>
        <div className={dashboardStyles.sectionHeader}>
          <h2 className={dashboardStyles.sectionTitle}>All Users</h2>
          <Button font="dashboard" variant="primary" label="Add New User" onClick={() => setShowAddModal(true)} />
        </div>

        <table className={dashboardStyles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Last Name</th>
              <th>Handler</th>
              <th>Email</th>
              <th>Type</th>
              <th>Featured</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <Input
                    id={`name-${user.id}`}
                    type="text"
                    variant="table"
                    value={getFieldValue(user, 'name')}
                    onChange={(e) => handleChange(user.id, 'name', e.target.value)}
                  />
                </td>
                <td>
                  <Input
                    id={`lastName-${user.id}`}
                    type="text"
                    variant="table"
                    value={getFieldValue(user, 'lastName')}
                    onChange={(e) => handleChange(user.id, 'lastName', e.target.value)}
                  />
                </td>
                <td>
                  <Input
                    id={`handler-${user.id}`}
                    type="text"
                    variant="table"
                    value={getFieldValue(user, 'handler')}
                    onChange={(e) => handleChange(user.id, 'handler', e.target.value)}
                  />
                </td>
                <td>
                  <Input
                    id={`email-${user.id}`}
                    type="email"
                    variant="table"
                    value={getFieldValue(user, 'email')}
                    onChange={(e) => handleChange(user.id, 'email', e.target.value)}
                  />
                </td>
                <td>{user.userType}</td>
                <td>
                  <Checkbox
                    checked={user.isFeatured ?? false}
                    onChange={async (e) => {
                      const newValue = e.target.checked
                      try {
                        await fetch(`/api/users/${user.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ isFeatured: newValue }),
                        })
                        refetch()
                      } catch (err) {
                        console.error('Failed to update featured status:', err)
                      }
                    }}
                  />
                </td>
                <td>
                  <div className={dashboardStyles.actions}>
                    {user.userType !== 'admin' && user.userType !== 'superAdmin' && (
                      <Button
                        font="dashboard"
                        variant="secondary"
                        label="Impersonate"
                        onClick={() => handleImpersonate(user)}
                      />
                    )}
                    {/* Only superAdmin can delete, and cannot delete themselves */}
                    {isSuperAdminUser && user.id !== session?.user?.id && (
                      <Button
                        font="dashboard"
                        variant="secondary"
                        label="Delete"
                        onClick={() => handleDeleteClick(user.id, `${user.name} ${user.lastName}`)}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Exhibitions Section */}
      <AdminExhibitions />

      {/* Content Management Section */}
      <ContentManagement />

      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)}>
          <AddArtistModal onClose={() => setShowAddModal(false)} onSuccess={handleAddSuccess} isSuperAdmin={isSuperAdminUser} />
        </Modal>
      )}

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <div className={dashboardStyles.deleteModal}>
            <h2>Delete User</h2>
            <p>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
              This action cannot be undone.
            </p>
            <div className={dashboardStyles.deleteWarning}>
              This action is not reversible. Please be certain.
            </div>
            <div className={dashboardStyles.deleteActions}>
              <Button font="dashboard" variant="secondary" label="Cancel" onClick={() => setDeleteTarget(null)} />
              <Button
                font="dashboard"
                variant="primary"
                label={deleting ? 'Deleting...' : 'Delete'}
                onClick={handleDeleteConfirm}
                disabled={deleting}
              />
            </div>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  )
}
