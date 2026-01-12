'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

import { Button } from '@/components/ui/Button'
import { Logout } from '@/components/ui/Logout'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { Text } from '@/components/ui/Typography'
import { AddArtworkModal } from '@/components/dashboard/AddArtworkModal'
import { useEffectiveUser } from '@/hooks/useEffectiveUser'

import styles from './artworks.module.scss'

// Helper to truncate text
const truncateText = (text: string | null | undefined, maxLength: number): string => {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

type Exhibition = {
  id: string
  mainTitle: string
}

type ExhibitionArtwork = {
  id: string
  exhibitionId: string
  exhibition: Exhibition
}

type Artwork = {
  id: string
  name: string
  artworkType: string
  title: string | null
  year: string | null
  technique: string | null
  imageUrl: string | null
  textContent: string | null
  createdAt: string
  exhibitionArtworks: ExhibitionArtwork[]
}

export const ArtworkLibraryPage = () => {
  const { effectiveUser, status: sessionStatus } = useEffectiveUser()
  const router = useRouter()

  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [unlinkTarget, setUnlinkTarget] = useState<{
    exhibitionArtworkId: string
    artworkName: string
    exhibitionTitle: string
  } | null>(null)
  const [unlinking, setUnlinking] = useState(false)
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'text'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Filter artworks based on selected type and search query
  const filteredArtworks = artworks.filter((artwork) => {
    // Type filter
    if (typeFilter !== 'all' && artwork.artworkType !== typeFilter) {
      return false
    }
    // Search filter (case-insensitive, matches name)
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase()
      const nameMatch = artwork.name?.toLowerCase().includes(searchLower)
      const titleMatch = artwork.title?.toLowerCase().includes(searchLower)
      return nameMatch || titleMatch
    }
    return true
  })

  // Redirect if not authenticated
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    }
  }, [sessionStatus, router])

  // Fetch artworks
  const fetchArtworks = useCallback(async () => {
    if (!effectiveUser?.id) return

    try {
      const response = await fetch(`/api/artworks?userId=${effectiveUser.id}`)
      const data = await response.json()
      setArtworks(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch artworks:', error)
    } finally {
      setLoading(false)
    }
  }, [effectiveUser?.id])

  useEffect(() => {
    if (effectiveUser?.id) {
      fetchArtworks()
    }
  }, [effectiveUser?.id, fetchArtworks])

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

  const handleUnlinkClick = useCallback(
    (exhibitionArtworkId: string, artworkName: string, exhibitionTitle: string) => {
      setUnlinkTarget({ exhibitionArtworkId, artworkName, exhibitionTitle })
    },
    [],
  )

  const handleUnlinkConfirm = useCallback(async () => {
    if (!unlinkTarget) return

    setUnlinking(true)
    try {
      const response = await fetch(`/api/exhibition-artworks/${unlinkTarget.exhibitionArtworkId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchArtworks()
        setUnlinkTarget(null)
      } else {
        alert('Failed to remove from exhibition')
      }
    } catch (error) {
      console.error('Unlink error:', error)
      alert('Failed to remove from exhibition')
    } finally {
      setUnlinking(false)
    }
  }, [unlinkTarget, fetchArtworks])

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className={styles.page}>
        <LoadingBar />
      </div>
    )
  }

  if (sessionStatus === 'unauthenticated') {
    return <div className={styles.page}>Not authorized</div>
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/dashboard" className={styles.backLink}>
          ← Back to Dashboard
        </Link>
        <Logout />
      </div>

      <Text font="dashboard" as="h1" className={styles.pageTitle}>
        Artwork Library
      </Text>

      <div className={styles.sectionActions}>
        <Button font="dashboard" variant="secondary" label="+ Add Artwork" onClick={() => setShowAddModal(true)} />
      </div>

      {/* Filter Tags and Search */}
      <div className={styles.filterBar}>
        <div className={styles.filters}>
          <button
            type="button"
            className={`${styles.filterTag} ${typeFilter === 'all' ? styles.active : ''}`}
            onClick={() => setTypeFilter('all')}
          >
            All
          </button>
          <button
            type="button"
            className={`${styles.filterTag} ${typeFilter === 'image' ? styles.active : ''}`}
            onClick={() => setTypeFilter('image')}
          >
            Image
          </button>
          <button
            type="button"
            className={`${styles.filterTag} ${typeFilter === 'text' ? styles.active : ''}`}
            onClick={() => setTypeFilter('text')}
          >
            Text
          </button>
        </div>
        <Input
          id="artwork-search"
          type="text"
          variant="search"
          placeholder="Search by name or title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {filteredArtworks.length === 0 ? (
        <div className={styles.empty}>
          <Text font="dashboard" as="p">
            {artworks.length === 0
              ? 'No artworks yet. Click "Add Artwork" to create your first one.'
              : 'No artworks match this filter.'}
          </Text>
        </div>
      ) : (
        <div className={styles.list}>
          {filteredArtworks.map((artwork) => (
            <div key={artwork.id} className={styles.card}>
              {/* Thumbnail / Text Preview */}
              <div className={styles.cardThumbnail}>
                {artwork.artworkType === 'image' && artwork.imageUrl ? (
                  <Image
                    src={artwork.imageUrl}
                    alt={artwork.name}
                    width={60}
                    height={60}
                    className={styles.thumbnail}
                  />
                ) : artwork.artworkType === 'text' && artwork.textContent ? (
                  <div className={styles.textPreview}>{truncateText(artwork.textContent, 100)}</div>
                ) : (
                  <div className={styles.placeholder}>
                    {artwork.artworkType === 'image' ? '🖼️' : '📝'}
                  </div>
                )}
              </div>
              <div className={styles.cardInfo}>
                <Text font="dashboard" as="h3">{artwork.name}</Text>
                <Text font="dashboard" as="p" className={styles.meta}>
                  {artwork.artworkType === 'image' ? 'Image' : 'Text'}
                  {artwork.title && ` • ${artwork.title}`}
                  {artwork.year && ` • ${artwork.year}`}
                  {artwork.technique && ` • ${artwork.technique}`}
                </Text>
                {artwork.exhibitionArtworks.length > 0 && (
                  <div className={styles.exhibitions}>
                    <span className={styles.exhibitionsLabel}>In:</span>
                    {artwork.exhibitionArtworks.map((ea) => (
                      <span key={ea.id} className={styles.exhibitionTag}>
                        {ea.exhibition.mainTitle}
                        <button
                          type="button"
                          className={styles.removeBtn}
                          onClick={() =>
                            handleUnlinkClick(ea.id, artwork.name, ea.exhibition.mainTitle)
                          }
                          title={`Remove from ${ea.exhibition.mainTitle}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.cardActions}>
                <Button
                  variant="secondary"
                  label="Edit"
                  onClick={() => router.push(`/dashboard/artworks/${artwork.id}/edit`)}
                />
                <Button
                  variant="primary"
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
            userId={effectiveUser?.id ?? ''}
            onClose={() => setShowAddModal(false)}
            onSuccess={handleAddSuccess}
          />
        </Modal>
      )}

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <div className={styles.deleteModal}>
            <Text font="dashboard" as="h2">Delete Artwork?</Text>
            <Text font="dashboard" as="p">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
              <br />
              This action cannot be undone.
            </Text>
            <div className={styles.deleteActions}>
              <Button
                variant="primary"
                label={deleting ? 'Deleting...' : 'Yes, Delete'}
                onClick={handleDeleteConfirm}
              />
              <Button font="dashboard" variant="secondary" label="Cancel" onClick={() => setDeleteTarget(null)} />
            </div>
          </div>
        </Modal>
      )}

      {unlinkTarget && (
        <Modal onClose={() => setUnlinkTarget(null)}>
          <div className={styles.deleteModal}>
            <Text font="dashboard" as="h2">Remove from Exhibition?</Text>
            <Text font="dashboard" as="p">
              Remove <strong>{unlinkTarget.artworkName}</strong> from{' '}
              <strong>{unlinkTarget.exhibitionTitle}</strong>?
              <br />
              The artwork will remain in your library.
            </Text>
            <div className={styles.deleteActions}>
              <Button
                variant="primary"
                label={unlinking ? 'Removing...' : 'Yes, Remove'}
                onClick={handleUnlinkConfirm}
              />
              <Button font="dashboard" variant="secondary" label="Cancel" onClick={() => setUnlinkTarget(null)} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
