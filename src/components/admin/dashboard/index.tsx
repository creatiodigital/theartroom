'use client'

import { useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { AddArtistModal } from '@/components/admin/AddArtistModal'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useUsers } from '@/hooks/useUsers'
import type { TUser } from '@/types/user'

export const DashboardAdmin = () => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const { users, loading, error, refetch } = useUsers()

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
  if (sessionStatus === 'loading' || loading) return <div>Loading...</div>
  
  // Not authorized
  if (sessionStatus === 'unauthenticated' || session?.user?.userType !== 'admin') {
    return <div>Not authorized</div>
  }

  if (error) return <div>Error: {error}</div>

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>All Users</h1>
        <Button variant="small" label="+ Add New Artist" onClick={() => setShowAddModal(true)} />
      </div>

      <table border={1} cellPadding="8" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Last Name</th>
            <th>Handler</th>
            <th>Email</th>
            <th>Type</th>
            <th>Biography</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                <input
                  type="text"
                  value={getFieldValue(user, 'name')}
                  onChange={(e) => handleChange(user.id, 'name', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={getFieldValue(user, 'lastName')}
                  onChange={(e) => handleChange(user.id, 'lastName', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={getFieldValue(user, 'handler')}
                  onChange={(e) => handleChange(user.id, 'handler', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="email"
                  value={getFieldValue(user, 'email')}
                  onChange={(e) => handleChange(user.id, 'email', e.target.value)}
                />
              </td>
              <td>{user.userType}</td>
              <td>
                <input
                  type="text"
                  value={getFieldValue(user, 'biography')}
                  onChange={(e) => handleChange(user.id, 'biography', e.target.value)}
                />
              </td>
              <td>
                <Button
                  variant="small"
                  label="Delete"
                  onClick={() => handleDeleteClick(user.id, `${user.name} ${user.lastName}`)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)}>
          <AddArtistModal
            onClose={() => setShowAddModal(false)}
            onSuccess={handleAddSuccess}
          />
        </Modal>
      )}

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <div style={{ textAlign: 'center' }}>
            <h2>Are you sure?</h2>
            <p style={{ margin: '1rem 0' }}>
              You are about to delete <strong>{deleteTarget.name}</strong>.
              <br />
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.5rem' }}>
              <Button
                variant="small"
                label={deleting ? 'Deleting...' : 'Yes, Delete'}
                onClick={handleDeleteConfirm}
              />
              <Button
                variant="small"
                label="Cancel"
                onClick={() => setDeleteTarget(null)}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
