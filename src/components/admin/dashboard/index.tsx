'use client'

import { useState, useCallback, useEffect as useEffectImport, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { MoreVertical } from 'lucide-react'

import { AddArtistModal } from '@/components/admin/AddArtistModal'
import { AdminExhibitions } from '@/components/admin/dashboard/AdminExhibitions'
import { ContentManagement } from '@/components/admin/dashboard/ContentManagement'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

import { Input } from '@/components/ui/Input'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { Modal } from '@/components/ui/Modal'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'
import { useEffectiveUser } from '@/hooks/useEffectiveUser'
import { useUsers } from '@/hooks/useUsers'
import type { TUser } from '@/types/user'

export const DashboardAdmin = () => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const { users, loading, error, refetch } = useUsers()
  const { startImpersonation, isImpersonating } = useEffectiveUser()

  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [inviteTarget, setInviteTarget] = useState<{
    id: string
    name: string
    email: string
  } | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close kebab menu on outside click
  useEffectImport(() => {
    if (!openMenuId) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenuId])

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
    setShowAddModal(false)
    refetch()
  }, [refetch])

  const handleTogglePublished = useCallback(
    async (userId: string, currentPublished: boolean) => {
      const newPublished = !currentPublished
      try {
        const response = await fetch(`/api/users/${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ published: newPublished }),
        })
        if (response.ok) {
          refetch()
        }
      } catch (error) {
        console.error('Failed to update published status:', error)
      }
    },
    [refetch],
  )

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
        <Button
          font="dashboard"
          variant="secondary"
          label="Test Dashboard"
          onClick={() => router.push('/dashboard')}
        />
      }
    >
      {/* Page Title */}
      <h1 className={dashboardStyles.pageTitle}>Admin Dashboard</h1>

      {/* Users Section */}
      <div className={dashboardStyles.section}>
        <div className={dashboardStyles.sectionHeader}>
          <h2 className={dashboardStyles.sectionTitle}>All Users</h2>
          <Button
            font="dashboard"
            variant="primary"
            label="Add New User"
            onClick={() => setShowAddModal(true)}
          />
        </div>

        <table className={dashboardStyles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Type</th>
              <th>Visibility</th>
              <th>Featured</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  {user.name} {user.lastName}
                </td>
                <td>{user.email || '-'}</td>
                <td>
                  {{
                    superAdmin: 'Super Admin',
                    admin: 'Admin',
                    artist: 'Artist',
                    curator: 'Curator',
                  }[user.userType ?? ''] || user.userType}
                </td>
                <td>
                  <Badge
                    label={user.published ? 'Published' : 'Unpublished'}
                    variant={user.published ? 'published' : 'unpublished'}
                  />
                </td>
                <td>{user.isFeatured && <Badge label="Featured" variant="current" />}</td>
                <td>
                  <div
                    className={dashboardStyles.kebabWrapper}
                    ref={openMenuId === user.id ? menuRef : undefined}
                  >
                    <button
                      className={dashboardStyles.kebabButton}
                      onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                      aria-label="Actions"
                    >
                      <MoreVertical size={16} strokeWidth={ICON_STROKE_WIDTH} />
                    </button>
                    {openMenuId === user.id && (
                      <div className={dashboardStyles.kebabMenu}>
                        {/* Invite - superAdmin only, for users with email */}
                        {isSuperAdminUser && user.email && (
                          <button
                            className={dashboardStyles.kebabMenuItem}
                            onClick={() => {
                              setOpenMenuId(null)
                              handleInviteClick(user)
                            }}
                          >
                            Invite
                          </button>
                        )}
                        <button
                          className={dashboardStyles.kebabMenuItem}
                          onClick={() => {
                            setOpenMenuId(null)
                            handleTogglePublished(user.id, user.published ?? false)
                          }}
                        >
                          {user.published ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          className={dashboardStyles.kebabMenuItem}
                          onClick={async () => {
                            setOpenMenuId(null)
                            try {
                              await fetch(`/api/users/${user.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ isFeatured: !user.isFeatured }),
                              })
                              refetch()
                            } catch (err) {
                              console.error('Failed to update featured status:', err)
                            }
                          }}
                        >
                          {user.isFeatured ? 'Remove Featured' : 'Set as Featured'}
                        </button>
                        {/* Impersonate */}
                        {user.id !== session?.user?.id &&
                          (isSuperAdminUser ||
                            (user.userType !== 'admin' && user.userType !== 'superAdmin')) && (
                            <button
                              className={dashboardStyles.kebabMenuItem}
                              disabled={isImpersonating && session?.impersonating?.id === user.id}
                              style={
                                isImpersonating && session?.impersonating?.id === user.id
                                  ? { opacity: 0.5, cursor: 'default' }
                                  : undefined
                              }
                              onClick={() => {
                                setOpenMenuId(null)
                                handleImpersonate(user)
                              }}
                            >
                              {isImpersonating && session?.impersonating?.id === user.id
                                ? 'Impersonating'
                                : 'Impersonate'}
                            </button>
                          )}
                        {/* Delete - superAdmin only */}
                        {isSuperAdminUser && user.id !== session?.user?.id && (
                          <button
                            className={`${dashboardStyles.kebabMenuItem} ${dashboardStyles.kebabMenuItemDanger}`}
                            onClick={() => {
                              setOpenMenuId(null)
                              handleDeleteClick(user.id, `${user.name} ${user.lastName}`)
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
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
          <AddArtistModal
            onClose={() => setShowAddModal(false)}
            onSuccess={handleAddSuccess}
            isSuperAdmin={isSuperAdminUser}
          />
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          onClose={() => {
            setDeleteTarget(null)
            setConfirmText('')
          }}
        >
          <div className={dashboardStyles.deleteModal}>
            <h2>Delete User</h2>
            <p>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action
              cannot be undone.
            </p>
            <div className={dashboardStyles.deleteWarning}>
              This action is not reversible. Please be certain.
            </div>
            <div className={dashboardStyles.confirmInput}>
              <label htmlFor="confirm-delete-user">
                Type <strong>CONFIRM</strong> to enable deletion:
              </label>
              <Input
                id="confirm-delete-user"
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
                onClick={() => {
                  setDeleteTarget(null)
                  setConfirmText('')
                }}
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
              <Button
                font="dashboard"
                variant="secondary"
                label="Cancel"
                onClick={() => setInviteTarget(null)}
              />
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
