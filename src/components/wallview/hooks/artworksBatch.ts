import type { StudioValues } from '@/hooks/artworkReread'
import { isLocalBlobUrl } from '@/lib/pendingUploads'
import type { TArtwork } from '@/types/artwork'

/**
 * A work as the wall save sends it. The save's copy of the works is the render's (useSaveExhibition
 * reads them with a selector), so the studio's values it puts in the store just before (Q157 a,
 * hooks/artworkReread.ts) are not in it: they go over it here.
 */
export const withStudioValues = (
  artworksById: Record<string, TArtwork>,
  studioValues: Record<string, StudioValues>,
  id: string,
): TArtwork | undefined => {
  const artwork = artworksById[id]
  return artwork && { ...artwork, ...studioValues[id] }
}

type ArtworksBatchInput = {
  allArtworkIds: string[]
  artworksById: Record<string, TArtwork>
  studioValues: Record<string, StudioValues>
  uploadedUrls: Map<string, string>
  originalDimensions: Map<string, { width: number; height: number }>
}

/** The `artworks` of the wall save's `POST /api/artworks/batch` (useSaveExhibition, step 3). */
export const buildArtworksBatch = ({
  allArtworkIds,
  artworksById,
  studioValues,
  uploadedUrls,
  originalDimensions,
}: ArtworksBatchInput) =>
  allArtworkIds
    .map((id) => {
      const artwork = withStudioValues(artworksById, studioValues, id)
      if (!artwork) return null

      let imageUrl = artwork.imageUrl || null

      // Use uploaded URL if available, otherwise keep existing cloud URL
      if (uploadedUrls.has(id)) {
        imageUrl = uploadedUrls.get(id)!
      } else if (isLocalBlobUrl(imageUrl || undefined)) {
        // Don't save local blob URLs
        imageUrl = null
      }

      // Get original dimensions (from pending upload or existing artwork)
      const dims = originalDimensions.get(id)

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
        textContent: artwork.textContent || null,
        featured: artwork.featured ?? false,
        hiddenFromExhibition: artwork.hiddenFromExhibition ?? false,
        // Include original dimensions if we have them
        originalWidth: dims?.width ?? artwork.originalWidth ?? null,
        originalHeight: dims?.height ?? artwork.originalHeight ?? null,
      }
    })
    .filter(Boolean)
