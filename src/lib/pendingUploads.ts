/**
 * Temporary storage for pending image uploads.
 *
 * When user uploads an image in the 2D wall, we:
 * 1. Create object URL for instant preview
 * 2. Store the File object here for later upload
 * 3. Store original image dimensions for aspect ratio restoration
 *
 * On Save button:
 * 1. Upload all pending files to Vercel Blob
 * 2. Update artwork imageUrls with cloud URLs
 * 3. Clear pending files
 */

type PendingUploadData = {
  file: File
  localUrl: string
  originalWidth: number
  originalHeight: number
}

// Map of artworkId -> upload data
const pendingUploads = new Map<string, PendingUploadData>()

export const addPendingUpload = (
  artworkId: string,
  file: File,
  localUrl: string,
  originalWidth: number,
  originalHeight: number,
) => {
  pendingUploads.set(artworkId, { file, localUrl, originalWidth, originalHeight })
}

export const removePendingUpload = (artworkId: string) => {
  const data = pendingUploads.get(artworkId)
  if (data) {
    URL.revokeObjectURL(data.localUrl)
    pendingUploads.delete(artworkId)
  }
}

export const getPendingUpload = (artworkId: string): PendingUploadData | undefined => {
  return pendingUploads.get(artworkId)
}

export const getPendingFile = (artworkId: string): File | undefined => {
  return pendingUploads.get(artworkId)?.file
}

export const getAllPendingUploads = (): Map<string, PendingUploadData> => {
  return pendingUploads
}

export const clearAllPendingUploads = () => {
  // Revoke all local URLs
  pendingUploads.forEach((data) => URL.revokeObjectURL(data.localUrl))
  pendingUploads.clear()
}

export const hasPendingUpload = (artworkId: string): boolean => {
  return pendingUploads.has(artworkId)
}

export const hasAnyPendingUploads = (): boolean => {
  return pendingUploads.size > 0
}

// Check if URL is a local blob URL (not yet uploaded)
export const isLocalBlobUrl = (url: string | undefined): boolean => {
  if (!url) return false
  return url.startsWith('blob:')
}

// Get original dimensions for an artwork
export const getOriginalDimensions = (
  artworkId: string,
): { width: number; height: number } | undefined => {
  const data = pendingUploads.get(artworkId)
  if (data) {
    return { width: data.originalWidth, height: data.originalHeight }
  }
  return undefined
}
