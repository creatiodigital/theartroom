'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Text } from '@/components/ui/Typography'
import { AddArtworkModal } from '@/components/dashboard/AddArtworkModal'
import { useEffectiveUser } from '@/hooks/useEffectiveUser'

import { DashboardLayout } from '../DashboardLayout'
import dashboardStyles from '../DashboardLayout/DashboardLayout.module.scss'
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
  order?: number
  exhibitionArtworks: ExhibitionArtwork[]
}

type SortableArtworkCardProps = {
  artwork: Artwork
  onEdit: (id: string) => void
  onDelete: (id: string, name: string) => void
  onUnlink: (exhibitionArtworkId: string, artworkName: string, exhibitionTitle: string) => void
}

function SortableArtworkCard({ artwork, onEdit, onDelete, onUnlink }: SortableArtworkCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: artwork.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className={styles.card}>
      {/* Drag Handle */}
      <div className={styles.dragHandle} {...attributes} {...listeners}>
        <span className={styles.dragIcon}>⠿</span>
      </div>

      {/* Thumbnail / Text Preview */}
      <div className={styles.cardThumbnail}>
        {artwork.artworkType === 'image' && artwork.imageUrl ? (
          <Image
            src={artwork.imageUrl}
            alt={artwork.title || 'Artwork'}
            width={60}
            height={60}
            className={styles.thumbnail}
          />
        ) : artwork.artworkType === 'text' && artwork.textContent ? (
          <div className={styles.textPreview}>{truncateText(artwork.textContent, 100)}</div>
        ) : (
          <div className={styles.placeholder}>
            <Icon
              name={artwork.artworkType === 'image' ? 'image' : 'type'}
              size={32}
              color="#666"
            />
          </div>
        )}
      </div>
      <div className={styles.cardInfo}>
        <Text font="dashboard" as="h3">{artwork.title}</Text>
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
                    onUnlink(ea.id, artwork.title || 'Artwork', ea.exhibition.mainTitle)
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
          onClick={() => onEdit(artwork.id)}
        />
        <Button
          variant="secondary"
          label="Delete"
          onClick={() => onDelete(artwork.id, artwork.title || 'Artwork')}
        />
      </div>
    </div>
  )
}

export const ArtworkLibraryPage = () => {
  const { effectiveUser } = useEffectiveUser()
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

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

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
    // Search filter (case-insensitive, matches title)
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase()
      const titleMatch = artwork.title?.toLowerCase().includes(searchLower)
      return titleMatch
    }
    return true
  })

  // Fetch artworks
  const fetchArtworks = useCallback(async () => {
    if (!effectiveUser?.id) return

    try {
      const response = await fetch(`/api/artworks?userId=${effectiveUser.id}`)
      const data = await response.json()
      // Sort by order field
      const sorted = Array.isArray(data)
        ? data.sort((a: Artwork, b: Artwork) => (a.order ?? 0) - (b.order ?? 0))
        : []
      setArtworks(sorted)
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = artworks.findIndex((a) => a.id === active.id)
      const newIndex = artworks.findIndex((a) => a.id === over.id)
      const newArtworks = arrayMove(artworks, oldIndex, newIndex)
      setArtworks(newArtworks)

      // Persist new order to the API
      try {
        await fetch('/api/artworks/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artworkIds: newArtworks.map((a) => a.id),
          }),
        })
      } catch (error) {
        console.error('Error reordering artworks:', error)
        // Refetch to restore server state on error
        fetchArtworks()
      }
    }
  }

  if (loading) {
    return <DashboardLayout backLink="/dashboard">Loading...</DashboardLayout>
  }

  return (
    <DashboardLayout backLink="/dashboard">
      {/* Page Title */}
      <h1 className={dashboardStyles.pageTitle}>Artwork Library</h1>

      {/* Filter Tags */}
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
        <div className={styles.searchRow}>
          <Input
            id="artwork-search"
            type="text"
            variant="search"
            placeholder="Search by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button font="dashboard" variant="primary" label="Add Artwork" onClick={() => setShowAddModal(true)} />
        </div>
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={filteredArtworks.map((a) => a.id)} strategy={verticalListSortingStrategy}>
            <div className={styles.list}>
              {filteredArtworks.map((artwork) => (
                <SortableArtworkCard
                  key={artwork.id}
                  artwork={artwork}
                  onEdit={(id) => router.push(`/dashboard/artworks/${id}/edit`)}
                  onDelete={handleDeleteClick}
                  onUnlink={handleUnlinkClick}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
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
    </DashboardLayout>
  )
}
