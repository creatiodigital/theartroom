'use client'

import { useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { AddArtistModal } from '@/components/admin/AddArtistModal'
import { AdminExhibitions } from '@/components/admin/dashboard/AdminExhibitions'
import { Button } from '@/components/ui/Button'
import { Logout } from '@/components/ui/Logout'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { Modal } from '@/components/ui/Modal'
import { Text } from '@/components/ui/Typography'
import { useEffectiveUser } from '@/hooks/useEffectiveUser'
import { useUsers } from '@/hooks/useUsers'
import type { TUser } from '@/types/user'

import styles from './AdminDashboard.module.scss'

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
    } else if (sessionStatus === 'authenticated' && session?.user?.userType !== 'admin') {
      router.push('/')
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
      <div className={styles.page}>
        <LoadingBar />
      </div>
    )

  // Not authorized
  if (sessionStatus === 'unauthenticated' || session?.user?.userType !== 'admin') {
    return <div className={styles.page}>Not authorized</div>
  }

  if (error) return <div className={styles.page}>Error: {error}</div>

  return (
    <div className={styles.page}>
      {/* Header with Logout */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Text as="h1">Admin Dashboard</Text>
        </div>
        <div className={styles.headerActions}>
          <Button size="small" label="My Dashboard" onClick={() => router.push('/dashboard')} />
          <Logout />
        </div>
      </div>

      {/* Users Section */}
      <div className={styles.section}>
        <Text as="h2" className={styles.sectionTitle}>
          All Users
        </Text>
        <div className={styles.sectionActions}>
          <Button size="small" label="+ Add New Artist" onClick={() => setShowAddModal(true)} />
        </div>

        <table className={styles.table}>
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
                  <div className={styles.actions}>
                    {user.userType !== 'admin' && (
                      <Button
                        size="small"
                        label="Impersonate"
                        onClick={() => handleImpersonate(user)}
                      />
                    )}
                    <Button
                      size="small"
                      label="Delete"
                      onClick={() => handleDeleteClick(user.id, `${user.name} ${user.lastName}`)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Exhibitions Section */}
      <AdminExhibitions />

      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)}>
          <AddArtistModal onClose={() => setShowAddModal(false)} onSuccess={handleAddSuccess} />
        </Modal>
      )}

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <div className={styles.deleteModal}>
            <Text as="h2">Are you sure?</Text>
            <Text as="p">
              You are about to delete <strong>{deleteTarget.name}</strong>.
              <br />
              This action cannot be undone.
            </Text>
            <div className={styles.deleteActions}>
              <Button
                size="small"
                label={deleting ? 'Deleting...' : 'Yes, Delete'}
                onClick={handleDeleteConfirm}
              />
              <Button size="small" label="Cancel" onClick={() => setDeleteTarget(null)} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
