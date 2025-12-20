import { useCallback, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSession } from 'next-auth/react'

import { 
  getAllPendingUploads, 
  clearAllPendingUploads,
  isLocalBlobUrl 
} from '@/lib/pendingUploads'
import { editArtisticImage } from '@/redux/slices/artworkSlice'
import type { RootState } from '@/redux/store'

export const useSaveExhibition = () => {
  const { data: session } = useSession()
  const dispatch = useDispatch()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const allArtworkIds = useSelector((state: RootState) => state.artworks.allIds)
  const positionsById = useSelector((state: RootState) => state.exhibition.exhibitionArtworksById)
  const exhibitionId = useSelector((state: RootState) => state.exhibition.id)

  const saveToDatabase = useCallback(async () => {
    if (!session?.user?.id) {
      setError('Not authenticated')
      return false
    }

    if (!exhibitionId) {
      setError('No exhibition ID')
      return false
    }

    if (allArtworkIds.length === 0) {
      // Nothing to save
      return true
    }

    setSaving(true)
    setError(null)

    try {
      // 1. Upload pending images to Vercel Blob
      const pendingUploads = getAllPendingUploads()
      const uploadedUrls = new Map<string, string>()

      for (const [artworkId, file] of pendingUploads) {
        const formData = new FormData()
        formData.append('image', file)

        // First save the artwork record (needed for the image API)
        const artwork = artworksById[artworkId]
        if (!artwork) {
          console.warn(`Artwork ${artworkId} not found in state, skipping upload`)
          continue
        }
        const artworkPayload = {
          id: artworkId,
          name: artwork.name || 'Untitled',
          artworkType: artwork.artworkType || 'image',
          title: artwork.artworkTitle || null,
          author: artwork.author || null,
          year: artwork.artworkYear || null,
          technique: null,
          dimensions: artwork.artworkDimensions || null,
          description: artwork.description || null,
          imageUrl: null, // Will be updated after upload
        }

        // Create/update artwork first
        await fetch('/api/artworks/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: session.user.id,
            artworks: [artworkPayload],
          }),
        })

        // Upload image
        const uploadResponse = await fetch(`/api/artworks/${artworkId}/image`, {
          method: 'POST',
          body: formData,
        })

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json()
          uploadedUrls.set(artworkId, uploadData.url)
          
          // Update Redux with cloud URL
          dispatch(editArtisticImage({
            currentArtworkId: artworkId,
            property: 'imageUrl',
            value: uploadData.url,
          }))
        } else {
          console.warn(`Failed to upload image for artwork ${artworkId}`)
        }
      }

      // Clear pending uploads after successful upload
      clearAllPendingUploads()

      const artworks = allArtworkIds
        .map((id) => {
          const artwork = artworksById[id]
          if (!artwork) return null
          
          let imageUrl = artwork.imageUrl || null
          
          // Use uploaded URL if available, otherwise keep existing cloud URL
          if (uploadedUrls.has(id)) {
            imageUrl = uploadedUrls.get(id)!
          } else if (isLocalBlobUrl(imageUrl || undefined)) {
            // Don't save local blob URLs
            imageUrl = null
          }

          return {
            id,
            name: artwork.name || 'Untitled',
            artworkType: artwork.artworkType || 'image',
            title: artwork.artworkTitle || null,
            author: artwork.author || null,
            year: artwork.artworkYear || null,
            technique: null,
            dimensions: artwork.artworkDimensions || null,
            description: artwork.description || null,
            imageUrl,
            textContent: artwork.textContent || null, // Fixed text content
          }
        })
        .filter(Boolean)

      // 3. Save artworks
      const artworkResponse = await fetch('/api/artworks/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          artworks,
        }),
      })

      if (!artworkResponse.ok) {
        const data = await artworkResponse.json()
        throw new Error(data.error || 'Failed to save artworks')
      }

      // 4. Prepare positions data (including display properties)
      const positions = allArtworkIds
        .filter((id) => positionsById[id] && artworksById[id])
        .map((id) => {
          const pos = positionsById[id]
          const artwork = artworksById[id]
          return {
            artworkId: id,
            wallId: pos.wallId,
            posX2d: pos.posX2d,
            posY2d: pos.posY2d,
            width2d: pos.width2d,
            height2d: pos.height2d,
            posX3d: pos.posX3d,
            posY3d: pos.posY3d,
            posZ3d: pos.posZ3d,
            quaternionX: pos.quaternionX,
            quaternionY: pos.quaternionY,
            quaternionZ: pos.quaternionZ,
            quaternionW: pos.quaternionW,
            // Display properties (per-exhibition)
            showFrame: artwork.showFrame ?? false,
            frameColor: artwork.frameColor ?? '#000000',
            frameThickness: artwork.frameThickness?.value ?? 5,
            showPassepartout: artwork.showPassepartout ?? false,
            passepartoutColor: artwork.passepartoutColor ?? '#ffffff',
            passepartoutThickness: artwork.passepartoutThickness?.value ?? 10,
            // Text styling (per-exhibition)
            fontFamily: artwork.fontFamily?.value ?? 'Montserrat',
            fontSize: artwork.fontSize?.value ?? 16,
            fontWeight: String(artwork.fontWeight?.value ?? '400'),
            letterSpacing: artwork.letterSpacing?.value ?? 0,
            lineHeight: artwork.lineHeight?.value ?? 1.4,
            textColor: artwork.textColor ?? '#000000',
            textAlign: artwork.textAlign ?? 'left',
          }
        })

      // 5. Save positions
      if (positions.length > 0) {
        const positionResponse = await fetch('/api/exhibition-artworks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exhibitionId,
            positions,
          }),
        })

        if (!positionResponse.ok) {
          const data = await positionResponse.json()
          throw new Error(data.error || 'Failed to save positions')
        }
      }

      return true
    } catch (err) {
      console.error('Save error:', err)
      setError(err instanceof Error ? err.message : 'Failed to save')
      return false
    } finally {
      setSaving(false)
    }
  }, [session?.user?.id, exhibitionId, allArtworkIds, artworksById, positionsById, dispatch])

  return {
    saveToDatabase,
    saving,
    error,
  }
}
