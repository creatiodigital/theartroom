'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { AddArtworkModal } from '@/components/dashboard/AddArtworkModal'

import styles from './artworks.module.scss'

type Artwork = {
  id: string
  name: string
  artworkType: string
  title: string | null
  year: string | null
  technique: string | null
  createdAt: string
}

export const ArtworkLibraryPage = () => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Redirect if not authenticated
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    }
  }, [sessionStatus, router])

  // Fetch artworks
  const fetchArtworks = useCallback(async () => {
    if (!session?.user?.id) return

    try {
      const response = await fetch(`/api/artworks?userId=${session.user.id}`)
      const data = await response.json()
      setArtworks(data)
    } catch (error) {
      console.error('Failed to fetch artworks:', error)
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (session?.user?.id) {
      fetchArtworks()
    }
  }, [session?.user?.id, fetchArtworks])

  const handleAddSuccess = useCallback(() => {
    fetchArtworks()
  }, [fetchArtworks])

  const handleDeleteClick = useCallback((id: string, name: string) => {
    setDeleteTarget({ id, name })
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/artworks/${deleteTarget.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchArtworks()
        setDeleteTarget(null)
      } else {
        alert('Failed to delete artwork')
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete artwork')
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, fetchArtworks])

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className={styles.page}>
        <p>Loading...</p>
      </div>
    )
  }

  if (sessionStatus === 'unauthenticated') {
    return <div className={styles.page}>Not authorized</div>
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <Link href="/dashboard" className={styles.backLink}>← Back to Dashboard</Link>
          <h1>Artwork Library</h1>
        </div>
        <Button variant="small" label="+ Add Artwork" onClick={() => setShowAddModal(true)} />
      </div>

      {artworks.length === 0 ? (
        <div className={styles.empty}>
          <p>No artworks yet. Click "Add Artwork" to create your first one.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {artworks.map((artwork) => (
            <div key={artwork.id} className={styles.card}>
              <div className={styles.cardInfo}>
                <h3>{artwork.name}</h3>
                <p className={styles.meta}>
                  {artwork.artworkType === 'image' ? '🖼️ Image' : '📝 Text'}
                  {artwork.title && ` • ${artwork.title}`}
                  {artwork.year && ` • ${artwork.year}`}
                  {artwork.technique && ` • ${artwork.technique}`}
                </p>
              </div>
              <div className={styles.cardActions}>
                <Button
                  variant="small"
                  label="Edit"
                  onClick={() => router.push(`/dashboard/artworks/${artwork.id}/edit`)}
                />
                <Button
                  variant="small"
                  label="Delete"
                  onClick={() => handleDeleteClick(artwork.id, artwork.name)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)}>
          <AddArtworkModal
            userId={session?.user?.id ?? ''}
            onClose={() => setShowAddModal(false)}
            onSuccess={handleAddSuccess}
          />
        </Modal>
      )}

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <div className={styles.deleteModal}>
            <h2>Delete Artwork?</h2>
            <p>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
              <br />
              This action cannot be undone.
            </p>
            <div className={styles.deleteActions}>
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
