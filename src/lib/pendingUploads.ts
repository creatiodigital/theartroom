/**
 * Temporary storage for pending image uploads.
 * 
 * When user uploads an image in the 2D wall, we:
 * 1. Create object URL for instant preview
 * 2. Store the File object here for later upload
 * 
 * On Save button:
 * 1. Upload all pending files to Vercel Blob
 * 2. Update artwork imageUrls with cloud URLs
 * 3. Clear pending files
 */

// Map of artworkId -> File
const pendingUploads = new Map<string, File>()

// Map of artworkId -> local blob URL (for cleanup)
const localBlobUrls = new Map<string, string>()

export const addPendingUpload = (artworkId: string, file: File, localUrl: string) => {
  pendingUploads.set(artworkId, file)
  localBlobUrls.set(artworkId, localUrl)
}

export const removePendingUpload = (artworkId: string) => {
  pendingUploads.delete(artworkId)
  const localUrl = localBlobUrls.get(artworkId)
  if (localUrl) {
    URL.revokeObjectURL(localUrl)
    localBlobUrls.delete(artworkId)
  }
}

export const getPendingUpload = (artworkId: string): File | undefined => {
  return pendingUploads.get(artworkId)
}

export const getAllPendingUploads = (): Map<string, File> => {
  return pendingUploads
}

export const clearAllPendingUploads = () => {
  // Revoke all local URLs
  localBlobUrls.forEach((url) => URL.revokeObjectURL(url))
  localBlobUrls.clear()
  pendingUploads.clear()
}

export const hasPendingUpload = (artworkId: string): boolean => {
  return pendingUploads.has(artworkId)
}

// Check if URL is a local blob URL (not yet uploaded)
export const isLocalBlobUrl = (url: string | undefined): boolean => {
  if (!url) return false
  return url.startsWith('blob:')
}
