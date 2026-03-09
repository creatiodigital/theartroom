'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSelector } from 'react-redux'

import { Icon } from '@/components/ui/Icon'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { Text } from '@/components/ui/Typography'
import { useEffectiveUser } from '@/hooks/useEffectiveUser'
import type { RootState } from '@/redux/store'

import styles from './MediaLibrary.module.scss'

type Artwork = {
  id: string
  name: string
  title?: string | null
  artworkType: string
  imageUrl?: string | null
  textContent?: string | null
  soundUrl?: string | null
}

const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

type MediaLibraryProps = {
  onClose: () => void
  onClickArtwork: (artwork: Artwork) => void
}

export const MediaLibrary = ({ onClose, onClickArtwork }: MediaLibraryProps) => {
  // Use effectiveUser to get the impersonated artist's ID when admin is impersonating
  const { effectiveUser } = useEffectiveUser()
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'text' | 'sound'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Get artworks already in this exhibition to filter them out
  const exhibitionArtworkIds = useSelector((state: RootState) => state.artworks.allIds)

  useEffect(() => {
    const fetchArtworks = async () => {
      if (!effectiveUser?.id) return

      try {
        // Use effectiveUser.id to fetch artworks of the impersonated artist (not the admin)
        const response = await fetch(`/api/artworks?userId=${effectiveUser.id}`)
        const data = await response.json()
        setArtworks(data)
      } catch (error) {
        console.error('Failed to fetch artworks:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchArtworks()
  }, [effectiveUser?.id])

  // Filter out artworks already in this exhibition
  const availableArtworks = artworks
    .filter((artwork) => !exhibitionArtworkIds.includes(artwork.id))
    .filter((artwork) => typeFilter === 'all' || artwork.artworkType === typeFilter)
    .filter((artwork) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        artwork.title?.toLowerCase().includes(q) ||
        artwork.name.toLowerCase().includes(q) ||
        artwork.textContent?.toLowerCase().includes(q)
      )
    })

  const handleDragStart = (e: React.DragEvent, artwork: Artwork) => {
    e.dataTransfer.setData('existingArtworkId', artwork.id)
    e.dataTransfer.setData('existingArtworkType', artwork.artworkType)
  }

  // Sound preview playback (single audio at a time)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const handleTogglePlay = useCallback(
    (artworkId: string, soundUrl: string) => {
      // Same sound — stop it
      if (audioRef.current && playingId === artworkId) {
        audioRef.current.pause()
        audioRef.current = null
        setPlayingId(null)
        return
      }

      // Stop any current sound
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }

      // Play new sound (no loop)
      const audio = new Audio(soundUrl)
      audio.addEventListener('ended', () => {
        setPlayingId(null)
        audioRef.current = null
      })
      audio.play()
      audioRef.current = audio
      setPlayingId(artworkId)
    },
    [playingId],
  )

  return (
    <div className={styles.sidebar} data-no-deselect="true">
      <div className={styles.header}>
        <Text font="dashboard" as="h3">
          Media Library
        </Text>
        <button className={styles.closeButton} onClick={onClose}>
          <Icon name="close" size={18} />
        </button>
      </div>

      <div className={styles.tabs}>
        {(['all', 'image', 'text', 'sound'] as const).map((type) => (
          <button
            key={type}
            className={`${styles.tab} ${typeFilter === type ? styles.tabActive : ''}`}
            onClick={() => setTypeFilter(type)}
          >
            {type === 'all'
              ? 'All'
              : type === 'image'
                ? 'Images'
                : type === 'text'
                  ? 'Text'
                  : 'Sound'}
          </button>
        ))}
      </div>

      <div className={styles.searchWrapper}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search artworks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <LoadingBar />
      ) : availableArtworks.length === 0 ? (
        <Text font="dashboard" as="p" className={styles.empty}>
          {artworks.length === 0
            ? 'No artworks in library. Create some first!'
            : 'All artworks are already in this exhibition.'}
        </Text>
      ) : (
        <div className={styles.grid}>
          {availableArtworks.map((artwork) => (
            <div key={artwork.id} className={styles.itemWrapper}>
              <div
                className={styles.item}
                onClick={() => onClickArtwork(artwork)}
                draggable
                onDragStart={(e) => handleDragStart(e, artwork)}
                style={
                  artwork.artworkType === 'image' && artwork.imageUrl
                    ? {
                        backgroundImage: `url(${artwork.imageUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : undefined
                }
              >
                {/* Show image, text preview, or icon */}
                {artwork.artworkType === 'image' &&
                artwork.imageUrl ? null : artwork.artworkType === 'text' && artwork.textContent ? (
                  <span className={styles.textPreview}>
                    {truncateText(artwork.textContent, 50)}
                  </span>
                ) : artwork.artworkType === 'sound' ? (
                  <div
                    className={`${styles.soundPlayBtn} ${artwork.soundUrl ? styles.playable : ''}`}
                    onClick={(e) => {
                      if (artwork.soundUrl) {
                        e.stopPropagation()
                        handleTogglePlay(artwork.id, artwork.soundUrl)
                      }
                    }}
                  >
                    <Icon
                      name={
                        playingId === artwork.id ? 'square' : artwork.soundUrl ? 'play' : 'volume-2'
                      }
                      size={32}
                      color={playingId === artwork.id ? '#e53e3e' : '#333'}
                    />
                  </div>
                ) : (
                  <Icon
                    name={artwork.artworkType === 'image' ? 'image' : 'type'}
                    size={32}
                    color="#333"
                  />
                )}
              </div>
              <span className={styles.name}>{artwork.title || artwork.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
