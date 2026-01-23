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

  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [inviteTarget, setInviteTarget] = useState<{ id: string; name: string; email: string } | null>(null)

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

  const handleInviteClick = useCallback((user: TUser) => {
    if (user.email) {
      setInviteTarget({ id: user.id, name: `${user.name} ${user.lastName}`, email: user.email })
    }
  }, [])

  const handleInviteConfirm = useCallback(async () => {
    if (!inviteTarget) return

    setInvitingId(inviteTarget.id)
    try {
      const response = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: inviteTarget.id }),
      })

      if (response.ok) {
        setInviteTarget(null)
        alert('Invite email sent successfully!')
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to send invite')
      }
    } catch (error) {
      console.error('Invite error:', error)
      alert('Failed to send invite')
    } finally {
      setInvitingId(null)
    }
  }, [inviteTarget])

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
        setConfirmText('')
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
                <td>{user.name}</td>
                <td>{user.lastName}</td>
                <td>{user.handler}</td>
                <td>{user.email || '-'}</td>
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
                    {/* Invite button - superAdmin only, for users with email */}
                    {isSuperAdminUser && user.email && (
                      <Button
                        font="dashboard"
                        variant="secondary"
                        label="Invite"
                        onClick={() => handleInviteClick(user)}
                      />
                    )}
                    {/* Impersonate logic:
                        - superAdmin: can impersonate anyone except themselves
                        - admin: can only impersonate artists/curators (not other admins) */}
                    {user.id !== session?.user?.id &&
                      (isSuperAdminUser ||
                        (user.userType !== 'admin' && user.userType !== 'superAdmin')) && (
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
        <Modal onClose={() => { setDeleteTarget(null); setConfirmText(''); }}>
          <div className={dashboardStyles.deleteModal}>
            <h2>Delete User</h2>
            <p>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
              This action cannot be undone.
            </p>
            <div className={dashboardStyles.deleteWarning}>
              This action is not reversible. Please be certain.
            </div>
            <div className={dashboardStyles.confirmInput}>
              <label htmlFor="confirm-delete-user">Type <strong>CONFIRM</strong> to enable deletion:</label>
              <Input
                id="confirm-delete-user"
                type="text"
                variant="table"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
            </div>
            <div className={dashboardStyles.deleteActions}>
              <Button font="dashboard" variant="secondary" label="Cancel" onClick={() => { setDeleteTarget(null); setConfirmText(''); }} />
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

      {inviteTarget && (
        <Modal onClose={() => setInviteTarget(null)}>
          <div className={dashboardStyles.deleteModal}>
            <h2>Send Invite Email</h2>
            <p>
              Send an invitation email to <strong>{inviteTarget.name}</strong>?
            </p>
            <p>
              The email will be sent to: <strong>{inviteTarget.email}</strong>
            </p>
            <div className={dashboardStyles.deleteActions}>
              <Button font="dashboard" variant="secondary" label="Cancel" onClick={() => setInviteTarget(null)} />
              <Button
                font="dashboard"
                variant="primary"
                label={invitingId === inviteTarget.id ? 'Sending...' : 'Send Invite'}
                onClick={handleInviteConfirm}
                disabled={invitingId === inviteTarget.id}
              />
            </div>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  )
}
