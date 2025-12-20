'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useSelector } from 'react-redux'

import { Icon } from '@/components/ui/Icon'
import type { RootState } from '@/redux/store'

import styles from './MediaLibrary.module.scss'

type Artwork = {
  id: string
  name: string
  artworkType: string
}

type MediaLibraryProps = {
  onClose: () => void
  onClickArtwork: (artwork: Artwork) => void
}

export const MediaLibrary = ({ onClose, onClickArtwork }: MediaLibraryProps) => {
  const { data: session } = useSession()
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [loading, setLoading] = useState(true)

  // Get artworks already in this exhibition to filter them out
  const exhibitionArtworkIds = useSelector((state: RootState) => state.artworks.allIds)

  useEffect(() => {
    const fetchArtworks = async () => {
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
    }

    fetchArtworks()
  }, [session?.user?.id])

  // Filter out artworks already in this exhibition
  const availableArtworks = artworks.filter(
    (artwork) => !exhibitionArtworkIds.includes(artwork.id)
  )

  const handleDragStart = (e: React.DragEvent, artwork: Artwork) => {
    e.dataTransfer.setData('existingArtworkId', artwork.id)
    e.dataTransfer.setData('existingArtworkType', artwork.artworkType)
  }

  return (
    <div className={styles.sidebar} data-no-deselect="true">
      <div className={styles.header}>
        <h3>Media Library</h3>
        <button className={styles.closeButton} onClick={onClose}>×</button>
      </div>
      
      {loading ? (
        <p className={styles.loading}>Loading...</p>
      ) : availableArtworks.length === 0 ? (
        <p className={styles.empty}>
          {artworks.length === 0 
            ? 'No artworks in library. Create some first!'
            : 'All artworks are already in this exhibition.'}
        </p>
      ) : (
        <div className={styles.grid}>
          {availableArtworks.map((artwork) => (
            <div key={artwork.id} className={styles.itemWrapper}>
              <div
                className={styles.item}
                onClick={() => onClickArtwork(artwork)}
                draggable
                onDragStart={(e) => handleDragStart(e, artwork)}
              >
                <Icon 
                  name={artwork.artworkType === 'image' ? 'picture' : 'text'} 
                  size={32} 
                  color="#333"
                />
              </div>
              <span className={styles.name}>{artwork.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
