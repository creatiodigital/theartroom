import { useCallback, useState } from 'react'
import { useSelector } from 'react-redux'
import { useSession } from 'next-auth/react'

import type { RootState } from '@/redux/store'

export const useSaveExhibition = () => {
  const { data: session } = useSession()
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
      // 1. Prepare artworks data
      const artworks = allArtworkIds.map((id) => {
        const artwork = artworksById[id]
        return {
          id,
          name: artwork.name || 'Untitled',
          artworkType: artwork.artworkType || 'image',
          title: artwork.artworkTitle || null,
          author: artwork.author || null,
          year: artwork.artworkYear || null,
          technique: null, // Not in current type
          dimensions: artwork.artworkDimensions || null,
          description: artwork.description || null,
          imageUrl: artwork.imageUrl || null,
        }
      })

      // 2. Save artworks
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

      // 3. Prepare positions data
      const positions = allArtworkIds
        .filter((id) => positionsById[id]) // Only artworks with positions
        .map((id) => {
          const pos = positionsById[id]
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
          }
        })

      // 4. Save positions
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
  }, [session?.user?.id, exhibitionId, allArtworkIds, artworksById, positionsById])

  return {
    saveToDatabase,
    saving,
    error,
  }
}
