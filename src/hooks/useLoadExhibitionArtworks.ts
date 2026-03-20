import { useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'

import {
  type ExhibitionArtworkResponse,
  mapToArtwork,
  mapToArtworkPosition,
} from '@/lib/exhibitionArtworkMapper'
import { restoreArtwork } from '@/redux/slices/artworkSlice'
import { createArtworkPosition } from '@/redux/slices/exhibitionSlice'

/**
 * Preload images and track progress
 */
const preloadImages = (
  imageUrls: string[],
  onProgress: (loaded: number, total: number) => void,
): Promise<void> => {
  return new Promise((resolve) => {
    if (imageUrls.length === 0) {
      onProgress(0, 0)
      resolve()
      return
    }

    let loaded = 0
    const total = imageUrls.length

    imageUrls.forEach((url) => {
      const img = new Image()
      img.onload = img.onerror = () => {
        loaded++
        onProgress(loaded, total)
        if (loaded === total) {
          resolve()
        }
      }
      img.src = url
    })
  })
}

export const useLoadExhibitionArtworks = (exhibitionId: string | undefined, mode?: 'edit') => {
  const dispatch = useDispatch()
  const [loading, setLoading] = useState(false)
  const [imagesLoading, setImagesLoading] = useState(false)
  const [imageProgress, setImageProgress] = useState({ loaded: 0, total: 0 })

  // Track which exhibition we've loaded to prevent duplicate loads
  // but allow loading different exhibitions
  const loadedExhibitionId = useRef<string | null>(null)

  useEffect(() => {
    // Skip if no exhibition ID
    if (!exhibitionId) return

    // Skip if we already loaded this exact exhibition
    if (loadedExhibitionId.current === exhibitionId) return

    const loadArtworks = async () => {
      setLoading(true)
      setImagesLoading(true)
      try {
        const modeParam = mode ? `&mode=${mode}` : ''
        const response = await fetch(
          `/api/exhibition-artworks?exhibitionId=${exhibitionId}${modeParam}`,
        )
        if (!response.ok) {
          console.error('Failed to load exhibition artworks')
          return
        }

        const exhibitionArtworks: ExhibitionArtworkResponse[] = await response.json()

        // Collect image URLs for preloading
        const imageUrls: string[] = []

        // Restore each artwork with full metadata from database
        exhibitionArtworks.forEach((ea) => {
          dispatch(restoreArtwork(mapToArtwork(ea)))

          // Collect image URL for preloading
          if (ea.artwork.imageUrl) {
            imageUrls.push(ea.artwork.imageUrl)
          }

          // Create position in exhibition slice
          dispatch(
            createArtworkPosition({
              artworkId: ea.artworkId,
              artworkPosition: mapToArtworkPosition(ea),
            }),
          )
        })

        // Mark data as loaded
        setLoading(false)

        // Preload all images
        await preloadImages(imageUrls, (loaded, total) => {
          setImageProgress({ loaded, total })
        })

        // Mark this exhibition as loaded
        loadedExhibitionId.current = exhibitionId
      } catch (error) {
        console.error('Error loading exhibition artworks:', error)
      } finally {
        setLoading(false)
        setImagesLoading(false)
      }
    }

    loadArtworks()

    // Reset ref on unmount so re-entering this page re-fetches live data
    return () => {
      loadedExhibitionId.current = null
    }
  }, [exhibitionId, dispatch])

  return {
    loading,
    imagesLoading,
    imageProgress,
    // Combined ready state - false until both data and images are loaded
    isReady: !loading && !imagesLoading,
  }
}

