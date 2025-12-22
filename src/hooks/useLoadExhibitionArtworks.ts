import { useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'

import { restoreArtwork } from '@/redux/slices/artworkSlice'
import { createArtworkPosition } from '@/redux/slices/exhibitionSlice'
import type { TArtwork, TArtworkPosition } from '@/types/artwork'

type ExhibitionArtworkResponse = {
  id: string
  exhibitionId: string
  artworkId: string
  artwork: {
    id: string
    name: string
    artworkType: string
    title: string | null
    author: string | null
    year: string | null
    technique: string | null
    dimensions: string | null
    description: string | null
    imageUrl: string | null
    textContent: string | null // Fixed text content
  }
  wallId: string
  posX2d: number
  posY2d: number
  width2d: number
  height2d: number
  posX3d: number
  posY3d: number
  posZ3d: number
  quaternionX: number
  quaternionY: number
  quaternionZ: number
  quaternionW: number
  // Display properties (per-exhibition)
  showFrame: boolean
  frameColor: string
  frameThickness: number
  showPassepartout: boolean
  passepartoutColor: string
  passepartoutThickness: number
  // Text styling (per-exhibition)
  fontFamily: string
  fontSize: number
  fontWeight: string
  letterSpacing: number
  lineHeight: number
  textColor: string
  textAlign: string
}

/**
 * Preload images and track progress
 */
const preloadImages = (
  imageUrls: string[],
  onProgress: (loaded: number, total: number) => void
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

export const useLoadExhibitionArtworks = (exhibitionId: string | undefined) => {
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
        const response = await fetch(`/api/exhibition-artworks?exhibitionId=${exhibitionId}`)
        if (!response.ok) {
          console.error('Failed to load exhibition artworks')
          return
        }

        const exhibitionArtworks: ExhibitionArtworkResponse[] = await response.json()

        // Collect image URLs for preloading
        const imageUrls: string[] = []

        // Restore each artwork with full metadata from database
        exhibitionArtworks.forEach((ea) => {
          // Restore artwork with full data including textContent and display properties
          const artwork: TArtwork = {
            id: ea.artworkId,
            name: ea.artwork.name,
            artworkType: ea.artwork.artworkType as 'image' | 'text',
            artworkTitle: ea.artwork.title || undefined,
            author: ea.artwork.author || undefined,
            artworkYear: ea.artwork.year || undefined,
            artworkDimensions: ea.artwork.dimensions || undefined,
            description: ea.artwork.description || undefined,
            imageUrl: ea.artwork.imageUrl || undefined,
            textContent: ea.artwork.textContent || undefined, // Fixed content from Artwork
            // Display properties from ExhibitionArtwork (per-exhibition)
            showFrame: ea.showFrame,
            frameColor: ea.frameColor,
            frameThickness: { label: String(ea.frameThickness), value: ea.frameThickness },
            showPassepartout: ea.showPassepartout,
            passepartoutColor: ea.passepartoutColor,
            passepartoutThickness: {
              label: String(ea.passepartoutThickness),
              value: ea.passepartoutThickness,
            },
            // Text styling from ExhibitionArtwork (per-exhibition)
            fontFamily: {
              label: ea.fontFamily,
              value: ea.fontFamily.toLowerCase() as 'roboto' | 'lora',
            },
            fontSize: { label: String(ea.fontSize), value: ea.fontSize },
            fontWeight: {
              label: ea.fontWeight,
              value: ea.fontWeight === '700' ? 'bold' : 'regular',
            },
            letterSpacing: { label: String(ea.letterSpacing), value: ea.letterSpacing },
            lineHeight: { label: String(ea.lineHeight), value: ea.lineHeight },
            textColor: ea.textColor,
            textAlign: ea.textAlign as 'left' | 'center' | 'right',
          }

          dispatch(restoreArtwork(artwork))

          // Collect image URL for preloading
          if (ea.artwork.imageUrl) {
            imageUrls.push(ea.artwork.imageUrl)
          }

          // Create position in exhibition slice
          // Compute width3d/height3d from 2D dimensions (scale factor is ~1/100)
          // This matches the formula in convert2DTo3D: width3d = width2d / 100
          const position: TArtworkPosition = {
            id: ea.id,
            artworkId: ea.artworkId,
            exhibitionId: ea.exhibitionId,
            wallId: ea.wallId,
            posX2d: ea.posX2d,
            posY2d: ea.posY2d,
            width2d: ea.width2d,
            height2d: ea.height2d,
            width3d: ea.width2d / 100,
            height3d: ea.height2d / 100,
            posX3d: ea.posX3d,
            posY3d: ea.posY3d,
            posZ3d: ea.posZ3d,
            quaternionX: ea.quaternionX,
            quaternionY: ea.quaternionY,
            quaternionZ: ea.quaternionZ,
            quaternionW: ea.quaternionW,
          }

          dispatch(createArtworkPosition({ artworkId: ea.artworkId, artworkPosition: position }))
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
  }, [exhibitionId, dispatch])

  return {
    loading,
    imagesLoading,
    imageProgress,
    // Combined ready state - false until both data and images are loaded
    isReady: !loading && !imagesLoading,
  }
}
