import { useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'

import { WALL_SCALE } from '@/components/wallview/constants'
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
    soundUrl: string | null
    originalWidth: number | null
    originalHeight: number | null
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
  frameSize: number // Border width (XY)
  frameThickness: number // Z-depth
  showPassepartout: boolean
  passepartoutColor: string
  passepartoutSize: number
  passepartoutThickness: number
  supportThickness: number
  supportColor: string
  showSupport: boolean
  hideShadow: boolean
  showArtworkInformation: boolean
  // Text styling (per-exhibition)
  fontFamily: string
  fontSize: number
  fontWeight: string
  letterSpacing: number
  lineHeight: number
  textColor: string
  textBackgroundColor: string | null
  textAlign: string
  textVerticalAlign: string
  textPadding: number
  textThickness: number
  // Sound styling (per-exhibition)
  soundIcon: string
  soundBackgroundColor: string | null
  soundIconColor: string
  soundIconSize: number
  soundPlayMode: string
  soundSpatial: boolean
  soundDistance: number
}

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
          // Restore artwork with full data including textContent and display properties
          const artwork: TArtwork = {
            id: ea.artworkId,
            name: ea.artwork.name,
            artworkType: ea.artwork.artworkType as 'image' | 'text' | 'sound',
            artworkTitle: ea.artwork.title || undefined,
            author: ea.artwork.author || undefined,
            artworkYear: ea.artwork.year || undefined,
            artworkDimensions: ea.artwork.dimensions || undefined,
            technique: ea.artwork.technique || undefined,
            description: ea.artwork.description || undefined,
            imageUrl: ea.artwork.imageUrl || undefined,
            originalWidth: ea.artwork.originalWidth ?? undefined,
            originalHeight: ea.artwork.originalHeight ?? undefined,
            textContent: ea.artwork.textContent || undefined, // Fixed content from Artwork
            soundUrl: ea.artwork.soundUrl || undefined,
            // Display properties from ExhibitionArtwork (per-exhibition)
            showFrame: ea.showFrame,
            frameColor: ea.frameColor,
            frameSize: { label: String(ea.frameSize ?? 3), value: ea.frameSize ?? 3 },
            frameThickness: {
              label: String(ea.frameThickness ?? 1),
              value: ea.frameThickness ?? 1,
            },
            showPassepartout: ea.showPassepartout,
            passepartoutColor: ea.passepartoutColor,
            passepartoutSize: {
              label: String(ea.passepartoutSize ?? 5),
              value: ea.passepartoutSize ?? 5,
            },
            // Clamp passepartoutThickness to valid range 0.1-1.0 (old data may have invalid values)
            passepartoutThickness: (() => {
              const val = ea.passepartoutThickness
              // If value is outside 0.1-1.0 range or undefined, default to 0.3
              const clampedVal = val && val >= 0.1 && val <= 1.0 ? val : 0.3
              return { label: String(clampedVal), value: clampedVal }
            })(),
            supportThickness: {
              label: String(ea.supportThickness ?? 2),
              value: ea.supportThickness ?? 2,
            },
            supportColor: ea.supportColor ?? '#ffffff',
            showSupport: ea.showSupport ?? false,
            hideShadow: ea.hideShadow ?? false,
            showArtworkInformation: ea.showArtworkInformation,
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
            textBackgroundColor: ea.textBackgroundColor ?? undefined,
            textAlign: ea.textAlign as 'left' | 'center' | 'right',
            textVerticalAlign: ea.textVerticalAlign as 'top' | 'center' | 'bottom',
            textPadding: { label: String(ea.textPadding ?? 0), value: ea.textPadding ?? 0 },
            textThickness: { label: String(ea.textThickness ?? 0), value: ea.textThickness ?? 0 },
            // Sound styling from ExhibitionArtwork (per-exhibition)
            soundIcon: ea.soundIcon ?? 'volume-2',
            soundBackgroundColor: ea.soundBackgroundColor ?? undefined,
            soundIconColor: ea.soundIconColor ?? '#000000',
            soundIconSize: ea.soundIconSize ?? 24,
            soundPlayMode: (ea.soundPlayMode ?? 'play-once') as 'loop' | 'play-once',
            soundSpatial: ea.soundSpatial ?? true,
            soundDistance: ea.soundDistance ?? 5,
          }

          dispatch(restoreArtwork(artwork))

          // Collect image URL for preloading
          if (ea.artwork.imageUrl) {
            imageUrls.push(ea.artwork.imageUrl)
          }

          // Create position in exhibition slice
          // Compute width3d/height3d from 2D dimensions (scale factor is ~1/100)
          // This matches the formula in convert2DTo3D: width3d = width2d / WALL_SCALE
          const position: TArtworkPosition = {
            id: ea.id,
            artworkId: ea.artworkId,
            exhibitionId: ea.exhibitionId,
            wallId: ea.wallId,
            posX2d: ea.posX2d,
            posY2d: ea.posY2d,
            width2d: ea.width2d,
            height2d: ea.height2d,
            width3d: ea.width2d / WALL_SCALE,
            height3d: ea.height2d / WALL_SCALE,
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
