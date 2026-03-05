/**
 * Autofocus Group — persisted as JSON on the Exhibition model.
 * When clicking any artwork that belongs to a group in 3D,
 * the camera focuses on the center of the whole group instead of the individual artwork.
 */
export type AutofocusGroup = {
  id: string
  name: string
  wallId: string
  artworkIds: string[] // ExhibitionArtwork IDs
}
