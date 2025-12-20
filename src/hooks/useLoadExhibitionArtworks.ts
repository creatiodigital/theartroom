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
}

export const useLoadExhibitionArtworks = (exhibitionId: string | undefined) => {
  const dispatch = useDispatch()
  const [loading, setLoading] = useState(false)
  
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
      try {
        const response = await fetch(`/api/exhibition-artworks?exhibitionId=${exhibitionId}`)
        if (!response.ok) {
          console.error('Failed to load exhibition artworks')
          return
        }

        const exhibitionArtworks: ExhibitionArtworkResponse[] = await response.json()

        // Restore each artwork with full metadata from database
        exhibitionArtworks.forEach((ea) => {
          // Restore artwork with full data (not just id/type)
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
          }
          
          dispatch(restoreArtwork(artwork))

          // Create position in exhibition slice
          const position: TArtworkPosition = {
            id: ea.id,
            artworkId: ea.artworkId,
            exhibitionId: ea.exhibitionId,
            wallId: ea.wallId,
            posX2d: ea.posX2d,
            posY2d: ea.posY2d,
            width2d: ea.width2d,
            height2d: ea.height2d,
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

        // Mark this exhibition as loaded
        loadedExhibitionId.current = exhibitionId
      } catch (error) {
        console.error('Error loading exhibition artworks:', error)
      } finally {
        setLoading(false)
      }
    }

    loadArtworks()
  }, [exhibitionId, dispatch])

  return { loading }
}
